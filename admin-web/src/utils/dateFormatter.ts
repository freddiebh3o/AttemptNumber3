// admin-web/src/utils/dateFormatter.ts
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/en-gb'; // British English locale

// Initialize dayjs plugins
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.locale('en-gb'); // Set British English as default locale

/**
 * Formats a date to British short format: dd/mm/yyyy
 *
 * @param date - Date object, ISO string, British formatted string, or any valid date string
 * @returns Formatted date string in dd/mm/yyyy format
 *
 * @example
 * formatDateUK(new Date('2025-10-26')) // "26/10/2025"
 * formatDateUK('2025-10-26T14:30:00Z') // "26/10/2025"
 * formatDateUK('26/10/2025') // "26/10/2025"
 * formatDateUK(null) // "—"
 */
export function formatDateUK(date: Date | string | null | undefined): string {
  if (!date) return '—';

  // If the input is already in British format (dd/mm/yyyy), parse it with custom format
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(date)) {
    const parsed = dayjs(date, 'DD/MM/YYYY', true);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : date.substring(0, 10);
  }

  return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Formats a date to readable British format: d MMMM yyyy
 *
 * @param date - Date object, ISO string, British formatted string, or any valid date string
 * @returns Formatted date string in "26 October 2025" format
 *
 * @example
 * formatDateReadable(new Date('2025-10-26')) // "26 October 2025"
 * formatDateReadable('2025-01-01T00:00:00Z') // "1 January 2025"
 * formatDateReadable('26/10/2025') // "26 October 2025"
 * formatDateReadable(null) // "—"
 */
export function formatDateReadable(date: Date | string | null | undefined): string {
  if (!date) return '—';

  // If the input is already in British format (dd/mm/yyyy), parse it with custom format
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(date)) {
    const parsed = dayjs(date, 'DD/MM/YYYY', true);
    return parsed.isValid() ? parsed.format('D MMMM YYYY') : date;
  }

  return dayjs(date).format('D MMMM YYYY');
}

/**
 * Formats a date and time to British short format: dd/mm/yyyy HH:mm
 *
 * @param date - Date object, ISO string, British formatted string, or any valid date string
 * @returns Formatted datetime string in dd/mm/yyyy HH:mm format (in UTC)
 *
 * @example
 * formatDateTimeUK(new Date('2025-10-26T14:30:00Z')) // "26/10/2025 14:30"
 * formatDateTimeUK('2025-10-26T09:15:00Z') // "26/10/2025 09:15"
 * formatDateTimeUK('26/10/2025 14:30') // "26/10/2025 14:30"
 * formatDateTimeUK(null) // "—"
 */
export function formatDateTimeUK(date: Date | string | null | undefined): string {
  if (!date) return '—';

  // If the input is already in British format (dd/mm/yyyy HH:mm), parse it with custom format
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}/.test(date)) {
    const parsed = dayjs(date, 'DD/MM/YYYY HH:mm', true);
    return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : date;
  }

  // Otherwise, treat as ISO string or Date object and format in UTC
  return dayjs.utc(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Formats a date and time to readable British format: d MMMM yyyy, HH:mm
 *
 * @param date - Date object, ISO string, British formatted string, or any valid date string
 * @returns Formatted datetime string in "26 October 2025, 14:30" format (in UTC)
 *
 * @example
 * formatDateTimeReadable(new Date('2025-10-26T14:30:00Z')) // "26 October 2025, 14:30"
 * formatDateTimeReadable('2025-10-26T09:15:00Z') // "26 October 2025, 09:15"
 * formatDateTimeReadable('26/10/2025 14:30') // "26 October 2025, 14:30"
 * formatDateTimeReadable(null) // "—"
 */
export function formatDateTimeReadable(date: Date | string | null | undefined): string {
  if (!date) return '—';

  // If the input is already in British format (dd/mm/yyyy HH:mm), parse it with custom format
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}/.test(date)) {
    const parsed = dayjs(date, 'DD/MM/YYYY HH:mm', true);
    return parsed.isValid() ? parsed.format('D MMMM YYYY, HH:mm') : date;
  }

  // Otherwise, treat as ISO string or Date object and format in UTC
  return dayjs.utc(date).format('D MMMM YYYY, HH:mm');
}

/**
 * Parses a British date string (dd/mm/yyyy) to a Date object
 *
 * @param dateString - Date string in dd/mm/yyyy format
 * @returns Date object or null if invalid
 *
 * @example
 * parseBritishDate('26/10/2025') // Date object for 26 October 2025
 * parseBritishDate('01/02/2025') // Date object for 1 February 2025 (NOT 2 January)
 * parseBritishDate('invalid') // null
 */
export function parseBritishDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  const parsed = dayjs(dateString, 'DD/MM/YYYY', true); // strict parsing
  return parsed.isValid() ? parsed.toDate() : null;
}

/**
 * Formats a date as relative time (e.g., "3 days ago", "in 2 hours")
 *
 * @param date - Date object, ISO string, or any valid date string
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(dayjs().subtract(3, 'days')) // "3 days ago"
 * formatRelativeTime(dayjs().add(2, 'hours')) // "in 2 hours"
 * formatRelativeTime(dayjs().subtract(1, 'minute')) // "a minute ago"
 * formatRelativeTime(null) // "—"
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).fromNow();
}

/**
 * Converts a Date object or ISO string to dd/mm/yyyy format for API requests
 *
 * @param date - Date object or ISO string
 * @returns Date string in dd/mm/yyyy format
 *
 * @example
 * toApiDateFormat(new Date('2025-10-26')) // "26/10/2025"
 * toApiDateFormat('2025-10-26T14:30:00Z') // "26/10/2025"
 */
export function toApiDateFormat(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Converts a dd/mm/yyyy string to ISO 8601 format for API requests (if needed)
 *
 * @param dateString - Date string in dd/mm/yyyy format
 * @returns ISO 8601 date string (yyyy-mm-dd)
 *
 * @example
 * toISODate('26/10/2025') // "2025-10-26"
 * toISODate('01/02/2025') // "2025-02-01"
 */
export function toISODate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  const parsed = dayjs(dateString, 'DD/MM/YYYY', true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}
