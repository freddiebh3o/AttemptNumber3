// api-server/src/utils/__tests__/dateFormatter.test.ts
import {
  formatDateUK,
  formatDateReadable,
  formatDateTimeUK,
  formatDateTimeReadable,
  formatISOToUK,
  formatISOToReadable,
} from '../dateFormatter.js';

describe('[DATE-FORMATTER] Date Formatter Utilities', () => {
  describe('formatDateUK - Format to dd/mm/yyyy', () => {
    it('should format Date object to dd/mm/yyyy', () => {
      const date = new Date('2025-10-26T14:30:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('26/10/2025');
    });

    it('should format ISO string to dd/mm/yyyy', () => {
      const result = formatDateUK('2025-10-26T14:30:00.000Z');
      expect(result).toBe('26/10/2025');
    });

    it('should pad single-digit day and month with zeros', () => {
      const date = new Date('2025-01-05T12:00:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('05/01/2025');
    });

    it('should handle end of year (31 December)', () => {
      const date = new Date('2025-12-31T23:59:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('31/12/2025');
    });

    it('should handle start of year (1 January)', () => {
      const date = new Date('2025-01-01T00:00:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('01/01/2025');
    });

    it('should return empty string for null', () => {
      const result = formatDateUK(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatDateUK(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date string', () => {
      const result = formatDateUK('invalid-date');
      expect(result).toBe('');
    });

    it('should handle epoch date (1 January 1970)', () => {
      const date = new Date('1970-01-01T00:00:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('01/01/1970');
    });

    it('should handle far future date', () => {
      const date = new Date('2099-12-31T23:59:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('31/12/2099');
    });
  });

  describe('formatDateReadable - Format to "26 October 2025"', () => {
    it('should format Date object to readable British format', () => {
      const date = new Date('2025-10-26T14:30:00.000Z');
      const result = formatDateReadable(date);
      expect(result).toBe('26 October 2025');
    });

    it('should format ISO string to readable British format', () => {
      const result = formatDateReadable('2025-10-26T14:30:00.000Z');
      expect(result).toBe('26 October 2025');
    });

    it('should format January correctly', () => {
      const date = new Date('2025-01-15T12:00:00.000Z');
      const result = formatDateReadable(date);
      expect(result).toBe('15 January 2025');
    });

    it('should format December correctly', () => {
      const date = new Date('2025-12-25T12:00:00.000Z');
      const result = formatDateReadable(date);
      expect(result).toBe('25 December 2025');
    });

    it('should return empty string for null', () => {
      const result = formatDateReadable(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatDateReadable(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date string', () => {
      const result = formatDateReadable('not-a-date');
      expect(result).toBe('');
    });
  });

  describe('formatDateTimeUK - Format to dd/mm/yyyy HH:mm', () => {
    it('should format Date object with time', () => {
      const date = new Date('2025-10-26T14:30:00.000Z');
      const result = formatDateTimeUK(date);
      expect(result).toBe('26/10/2025 14:30');
    });

    it('should format ISO string with time', () => {
      const result = formatDateTimeUK('2025-10-26T09:05:00.000Z');
      expect(result).toBe('26/10/2025 09:05');
    });

    it('should pad single-digit hours and minutes', () => {
      const date = new Date('2025-01-05T09:05:00.000Z');
      const result = formatDateTimeUK(date);
      expect(result).toBe('05/01/2025 09:05');
    });

    it('should handle midnight (00:00)', () => {
      // Create a date at midnight in the local timezone (not UTC)
      const date = new Date(2025, 9, 26, 0, 0, 0); // Month is 0-indexed, so 9 = October
      const result = formatDateTimeUK(date);
      expect(result).toBe('26/10/2025 00:00');
    });

    it('should handle end of day (23:59)', () => {
      const date = new Date('2025-10-26T23:59:00.000Z');
      const result = formatDateTimeUK(date);
      expect(result).toBe('26/10/2025 23:59');
    });

    it('should return empty string for null', () => {
      const result = formatDateTimeUK(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatDateTimeUK(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date string', () => {
      const result = formatDateTimeUK('invalid');
      expect(result).toBe('');
    });
  });

  describe('formatDateTimeReadable - Format to "26 October 2025, 14:30"', () => {
    it('should format Date object with readable time', () => {
      const date = new Date('2025-10-26T14:30:00.000Z');
      const result = formatDateTimeReadable(date);
      expect(result).toBe('26 October 2025, 14:30');
    });

    it('should format ISO string with readable time', () => {
      const result = formatDateTimeReadable('2025-10-26T14:30:00.000Z');
      expect(result).toBe('26 October 2025, 14:30');
    });

    it('should handle morning time (09:15)', () => {
      const date = new Date('2025-01-15T09:15:00.000Z');
      const result = formatDateTimeReadable(date);
      expect(result).toBe('15 January 2025, 09:15');
    });

    it('should handle evening time (18:45)', () => {
      const date = new Date('2025-12-25T18:45:00.000Z');
      const result = formatDateTimeReadable(date);
      expect(result).toBe('25 December 2025, 18:45');
    });

    it('should return empty string for null', () => {
      const result = formatDateTimeReadable(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatDateTimeReadable(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid date string', () => {
      const result = formatDateTimeReadable('bad-date');
      expect(result).toBe('');
    });
  });

  describe('formatISOToUK - Convert ISO string to dd/mm/yyyy', () => {
    it('should convert ISO 8601 string to dd/mm/yyyy', () => {
      const result = formatISOToUK('2025-10-26T14:30:00.000Z');
      expect(result).toBe('26/10/2025');
    });

    it('should handle ISO string without milliseconds', () => {
      const result = formatISOToUK('2025-10-26T14:30:00Z');
      expect(result).toBe('26/10/2025');
    });

    it('should return empty string for null', () => {
      const result = formatISOToUK(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatISOToUK(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid ISO string', () => {
      const result = formatISOToUK('not-iso-format');
      expect(result).toBe('');
    });
  });

  describe('formatISOToReadable - Convert ISO string to readable format', () => {
    it('should convert ISO 8601 string to readable British format', () => {
      const result = formatISOToReadable('2025-10-26T14:30:00.000Z');
      expect(result).toBe('26 October 2025');
    });

    it('should handle ISO string without milliseconds', () => {
      const result = formatISOToReadable('2025-01-15T12:00:00Z');
      expect(result).toBe('15 January 2025');
    });

    it('should return empty string for null', () => {
      const result = formatISOToReadable(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatISOToReadable(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for invalid ISO string', () => {
      const result = formatISOToReadable('invalid-iso');
      expect(result).toBe('');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle leap year (29 February 2024)', () => {
      const date = new Date('2024-02-29T12:00:00.000Z');
      const resultUK = formatDateUK(date);
      const resultReadable = formatDateReadable(date);

      expect(resultUK).toBe('29/02/2024');
      expect(resultReadable).toBe('29 February 2024');
    });

    it('should handle century boundary (1 January 2000)', () => {
      const date = new Date('2000-01-01T00:00:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('01/01/2000');
    });

    it('should handle millennium boundary (1 January 2001)', () => {
      const date = new Date('2001-01-01T00:00:00.000Z');
      const result = formatDateUK(date);
      expect(result).toBe('01/01/2001');
    });

    it('should handle date with seconds and milliseconds (ignore them)', () => {
      const date = new Date('2025-10-26T14:30:45.678Z');
      const result = formatDateTimeUK(date);
      expect(result).toBe('26/10/2025 14:30'); // Seconds and ms ignored
    });
  });

  describe('Consistency Across Functions', () => {
    it('formatDateUK and formatISOToUK should produce same output', () => {
      const isoString = '2025-10-26T14:30:00.000Z';
      const date = new Date(isoString);

      const resultISO = formatISOToUK(isoString);
      const resultDate = formatDateUK(date);

      expect(resultISO).toBe(resultDate);
      expect(resultISO).toBe('26/10/2025');
    });

    it('formatDateReadable and formatISOToReadable should produce same output', () => {
      const isoString = '2025-10-26T14:30:00.000Z';
      const date = new Date(isoString);

      const resultISO = formatISOToReadable(isoString);
      const resultDate = formatDateReadable(date);

      expect(resultISO).toBe(resultDate);
      expect(resultISO).toBe('26 October 2025');
    });
  });
});
