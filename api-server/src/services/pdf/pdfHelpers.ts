// api-server/src/services/pdf/pdfHelpers.ts
/**
 * Formatting utilities for PDF generation
 */

/**
 * Format date to readable string (e.g., "15 January 2025")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format date with time (e.g., "15 January 2025, 14:30")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency from pence to pounds (e.g., 1000 => "£10.00")
 */
export function formatCurrency(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pounds);
}

/**
 * Escape HTML special characters to prevent injection
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Extract primary color from branding overrides JSON
 */
export function getPrimaryColor(overridesJson: any): string {
  try {
    if (overridesJson && typeof overridesJson === 'object') {
      return overridesJson.primaryColor || '#228be6'; // Mantine default blue
    }
  } catch {
    // Invalid JSON, use default
  }
  return '#228be6';
}
