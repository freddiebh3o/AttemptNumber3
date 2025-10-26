// api-server/src/utils/dateFormatter.ts
/**
 * Centralized date formatting utilities for British (UK) date formats.
 *
 * This module provides consistent date formatting across the entire backend,
 * ensuring all dates are displayed in British format (dd/mm/yyyy) or readable
 * British English format ("26 October 2025").
 *
 * All functions use the 'en-GB' locale for consistency.
 */

/**
 * Format a date to British short format: dd/mm/yyyy
 *
 * @example
 * formatDateUK(new Date('2025-10-26')) // "26/10/2025"
 * formatDateUK('2025-10-26T14:30:00.000Z') // "26/10/2025"
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted date string in dd/mm/yyyy format
 */
export function formatDateUK(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format a date to readable British format: "26 October 2025"
 *
 * @example
 * formatDateReadable(new Date('2025-10-26')) // "26 October 2025"
 * formatDateReadable('2025-10-26T14:30:00.000Z') // "26 October 2025"
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted date string in readable British format
 */
export function formatDateReadable(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a date with time to British short format: dd/mm/yyyy HH:mm
 *
 * @example
 * formatDateTimeUK(new Date('2025-10-26T14:30:00')) // "26/10/2025 14:30"
 * formatDateTimeUK('2025-10-26T14:30:00.000Z') // "26/10/2025 14:30"
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted date-time string in dd/mm/yyyy HH:mm format
 */
export function formatDateTimeUK(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  const datePart = formatDateUK(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Format a date with time to readable British format: "26 October 2025, 14:30"
 *
 * @example
 * formatDateTimeReadable(new Date('2025-10-26T14:30:00')) // "26 October 2025, 14:30"
 * formatDateTimeReadable('2025-10-26T14:30:00.000Z') // "26 October 2025, 14:30"
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted date-time string in readable British format
 */
export function formatDateTimeReadable(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  // Format date part
  const datePart = formatDateReadable(d);

  // Format time part manually to ensure "HH:mm" format
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${datePart}, ${hours}:${minutes}`;
}

/**
 * Convert an ISO 8601 date string to British short format: dd/mm/yyyy
 *
 * @example
 * formatISOToUK('2025-10-26T14:30:00.000Z') // "26/10/2025"
 *
 * @param isoString - ISO 8601 date string
 * @returns Formatted date string in dd/mm/yyyy format
 */
export function formatISOToUK(isoString: string | null | undefined): string {
  if (!isoString) return '';
  return formatDateUK(isoString);
}

/**
 * Convert an ISO 8601 date string to readable British format: "26 October 2025"
 *
 * @example
 * formatISOToReadable('2025-10-26T14:30:00.000Z') // "26 October 2025"
 *
 * @param isoString - ISO 8601 date string
 * @returns Formatted date string in readable British format
 */
export function formatISOToReadable(isoString: string | null | undefined): string {
  if (!isoString) return '';
  return formatDateReadable(isoString);
}
