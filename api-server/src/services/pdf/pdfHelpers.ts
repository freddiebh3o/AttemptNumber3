// api-server/src/services/pdf/pdfHelpers.ts
/**
 * Formatting utilities for PDF generation
 */

import {
  formatDateReadable,
  formatDateTimeReadable,
} from '../../utils/dateFormatter.js';

/**
 * Format date to readable string (e.g., "15 January 2025")
 *
 * @deprecated Use formatDateReadable from dateFormatter.ts instead
 */
export function formatDate(date: Date | string): string {
  return formatDateReadable(date);
}

/**
 * Format date with time (e.g., "15 January 2025, 14:30")
 *
 * @deprecated Use formatDateTimeReadable from dateFormatter.ts instead
 */
export function formatDateTime(date: Date | string): string {
  return formatDateTimeReadable(date);
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
