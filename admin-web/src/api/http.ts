// admin-web/src/api/http.ts
import { useLoadingBus } from '../hooks/useLoadingBus';

const apiBaseUrlFromEnvironmentVariable = import.meta.env.VITE_API_BASE_URL as string;

// Internal caches for GET/HEAD requests
const inFlight = new Map<string, Promise<any>>();
const recent = new Map<string, { ts: number; value: any }>();

const DEFAULT_RECENT_TTL_MS = 250;

// Allow callers to override dedupe behavior if ever needed
type ExtendedInit = RequestInit & {
  __skipDedupe?: boolean;
  __dedupeTtlMs?: number;
};

function isCacheableMethod(method: string | undefined) {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

function makeKey(url: string, method: string, headersObj: Record<string, string>, body: any) {
  // Keep it stable and reasonably unique; don’t include volatile headers like cookies
  return [
    method.toUpperCase(),
    url,
    // Only include headers that meaningfully change response. Customize if needed.
    headersObj['accept'],
    headersObj['content-type'],
    typeof body === 'string' ? body : body ? JSON.stringify(body) : '',
  ].join('::');
}

export async function httpRequestJson<DataShape>(
  httpPathRelativeToApiBaseUrl: string,
  httpInitOptions: RequestInit = {}
): Promise<DataShape> {
  const fullUrl = `${apiBaseUrlFromEnvironmentVariable}${httpPathRelativeToApiBaseUrl}`;

  // Extract headers to prevent them from overwriting our merged headers later
  const { headers: callerHeaders, ...restInit } = httpInitOptions as ExtendedInit;

  // Normalize possible Headers | string[][] | Record<string,string> to a plain object
  const callerHeadersObj =
    callerHeaders instanceof Headers
      ? Object.fromEntries(callerHeaders.entries())
      : Array.isArray(callerHeaders)
      ? Object.fromEntries(callerHeaders)
      : (callerHeaders as Record<string, string> | undefined) ?? {};

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...callerHeadersObj,
  };

  const method = (restInit.method ?? 'GET').toUpperCase();
  const isCacheable = isCacheableMethod(method);
  const skipDedupe = (restInit as ExtendedInit).__skipDedupe === true;
  const ttl = (restInit as ExtendedInit).__dedupeTtlMs ?? DEFAULT_RECENT_TTL_MS;

  // Build a stable key for cacheable requests
  const key = isCacheable ? makeKey(fullUrl, method, mergedHeaders, restInit.body) : '';

  // 1) If cacheable and there's an in-flight identical request, return that promise.
  if (isCacheable && !skipDedupe) {
    const existing = inFlight.get(key);
    if (existing) {
      return existing as Promise<DataShape>;
    }

    // 2) If we very recently completed the same request, return the recent value (burst cooldown)
    const now = Date.now();
    const recentHit = recent.get(key);
    if (recentHit && now - recentHit.ts <= ttl) {
      return recentHit.value as DataShape;
    }
  }

  // Loading bus helpers (Zustand store; no provider needed)
  const loading = {
    inc: () => useLoadingBus.getState().increment(),
    dec: () => useLoadingBus.getState().decrement(),
  };

  // The actual network call wrapped so we can put it in the in-flight map
  const performFetch = async () => {
    const httpResponse = await fetch(fullUrl, {
      credentials: 'include',
      ...restInit, // everything except headers (and our custom dedupe fields)
      headers: mergedHeaders,
    });

    // Read text first, then attempt JSON parse (more robust than .json())
    const raw = await httpResponse.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (!json || typeof json !== 'object') {
      const invalidErr = new Error(`Invalid JSON from ${fullUrl}`) as Error & {
        httpStatusCode?: number;
      };
      invalidErr.httpStatusCode = httpResponse.status;
      throw invalidErr;
    }

    // Your API uses an envelope: { success: boolean, ... }
    if (json.success === true) {
      return json as DataShape;
    }

    // Standardized error object
    const errorBody = json?.error;
    const message =
      errorBody?.userFacingMessage ||
      `Request failed (${httpResponse.status}) at ${httpPathRelativeToApiBaseUrl}`;

    const error = new Error(message) as Error & {
      details?: unknown;
      httpStatusCode?: number;
      correlationId?: string;
    };

    error.details = json;
    error.httpStatusCode = errorBody?.httpStatusCode ?? httpResponse.status;
    error.correlationId = errorBody?.correlationId ?? json?.correlationId;

    throw error;
  };

  // Only increment the loading bus if we are actually hitting the network
  if (isCacheable && !skipDedupe) {
    const fetchPromise = (async () => {
      loading.inc();
      try {
        const result = await performFetch();
        // Save the successful result into the recent cache (cooldown window)
        recent.set(key, { ts: Date.now(), value: result });
        return result;
      } finally {
        loading.dec();
        // Remove from in-flight regardless of success/failure
        inFlight.delete(key);
      }
    })();

    // Register in-flight and return
    inFlight.set(key, fetchPromise);
    return fetchPromise as Promise<DataShape>;
  }

  // Non-cacheable or explicitly skipped: regular path
  loading.inc();
  try {
    return await performFetch();
  } finally {
    loading.dec();
  }
}
