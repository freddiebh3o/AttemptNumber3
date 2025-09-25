// admin-web/src/api/http.ts
const apiBaseUrlFromEnvironmentVariable = import.meta.env.VITE_API_BASE_URL as string

export async function httpRequestJson<DataShape>(
  httpPathRelativeToApiBaseUrl: string,
  httpInitOptions: RequestInit = {}
): Promise<DataShape> {
  const fullUrl = `${apiBaseUrlFromEnvironmentVariable}${httpPathRelativeToApiBaseUrl}`

  // Extract headers to prevent them from overwriting our merged headers later
  const { headers: callerHeaders, ...restInit } = httpInitOptions
  // Normalize possible Headers | string[][] | Record<string,string> to a plain object
  const callerHeadersObj =
    callerHeaders instanceof Headers
      ? Object.fromEntries(callerHeaders.entries())
      : Array.isArray(callerHeaders)
      ? Object.fromEntries(callerHeaders)
      : (callerHeaders as Record<string, string> | undefined) ?? {}

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...callerHeadersObj,
  }

  const httpResponse = await fetch(fullUrl, {
    credentials: 'include',
    ...restInit,         // everything except headers
    headers: mergedHeaders,  // our merged headers (Content-Type preserved)
  })

  const json = await httpResponse.json().catch(() => null)
  if (!json) throw new Error(`Invalid JSON from ${fullUrl}`)

  if (json.success === true) return json as DataShape

  const errorBody = json?.error
  const message =
    errorBody?.userFacingMessage ||
    `Request failed (${httpResponse.status}) at ${httpPathRelativeToApiBaseUrl}`

  const error = new Error(message) as Error & { details?: unknown; httpStatusCode?: number }
  error.details = json
  error.httpStatusCode = errorBody?.httpStatusCode
  throw error
}
