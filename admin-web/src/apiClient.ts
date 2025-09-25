export const apiBaseUrlFromEnvironmentVariable: string =
  import.meta.env.VITE_API_BASE_URL;

export async function fetchApiHealthCheck(): Promise<{ success: boolean; data?: any; error?: any }> {
  const apiHealthCheckUrl = `${apiBaseUrlFromEnvironmentVariable}/api/health`;
  const httpResponse = await fetch(apiHealthCheckUrl, { credentials: 'include' });
  return httpResponse.json();
}
