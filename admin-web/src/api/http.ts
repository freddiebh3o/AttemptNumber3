// admin-web/src/api/http.ts
import { useLoadingBus } from '../hooks/useLoadingBus';
const apiBaseUrlFromEnvironmentVariable = import.meta.env.VITE_API_BASE_URL as string;

export async function httpRequestJson<DataShape>(
  httpPathRelativeToApiBaseUrl: string,
  httpInitOptions: RequestInit = {}
): Promise<DataShape> {
  const fullUrl = `${apiBaseUrlFromEnvironmentVariable}${httpPathRelativeToApiBaseUrl}`;

  // Extract headers to prevent them from overwriting our merged headers later
  const { headers: callerHeaders, ...restInit } = httpInitOptions;

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

  // Loading bus helpers (Zustand store; no provider needed)
  const loading = {
    inc: () => useLoadingBus.getState().increment(),
    dec: () => useLoadingBus.getState().decrement(),
  };

  loading.inc();
  try {
    const httpResponse = await fetch(fullUrl, {
      credentials: 'include',
      ...restInit, // everything except headers
      headers: mergedHeaders, // our merged headers (Content-Type preserved)
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
  } finally {
    loading.dec();
  }
}
