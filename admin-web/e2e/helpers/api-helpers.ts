import type { Page } from '@playwright/test';

/**
 * Get the API base URL from environment or use default
 *
 * @returns API base URL
 */
export function getApiUrl(): string {
  return process.env.VITE_API_BASE_URL || 'http://localhost:4000';
}

/**
 * Get cookie header string from page context for authenticated requests
 *
 * @param page - Playwright page object
 * @returns Cookie header string (e.g., "session=abc123; tenant=xyz")
 */
export async function getCookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * Make an authenticated API request using page context cookies
 *
 * @param page - Playwright page object
 * @param method - HTTP method
 * @param path - API path (e.g., '/api/products')
 * @param data - Optional request body data
 * @returns Response object
 *
 * @example
 * ```typescript
 * const response = await makeAuthenticatedRequest(page, 'POST', '/api/products', {
 *   productName: 'Test Product',
 *   productSku: 'TEST-001',
 *   productPricePence: 1000,
 * });
 *
 * if (!response.ok()) {
 *   throw new Error(`Request failed: ${response.status()}`);
 * }
 *
 * const data = await response.json();
 * ```
 */
export async function makeAuthenticatedRequest(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: any
) {
  const apiUrl = getApiUrl();
  const cookieHeader = await getCookieHeader(page);

  const options: any = {
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.data = data;
  }

  return page.request.fetch(`${apiUrl}${path}`, {
    method,
    ...options,
  });
}
