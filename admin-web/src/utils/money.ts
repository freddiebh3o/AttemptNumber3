// admin-web/src/utils/money.ts

/**
 * Convert a minor-unit value (pence) to major units (pounds).
 * 12345 -> 123.45
 */
export function penceToPounds(pence: number): number {
    if (!Number.isFinite(pence)) throw new Error('pence must be a finite number');
    // Ensure integer to avoid weird floats coming in
    return Math.trunc(pence) / 100;
  }
  
  /**
   * Format a pence amount as a GBP currency string.
   * Examples:
   *   formatPenceAsGBP(0)        -> "£0.00"
   *   formatPenceAsGBP(1999)     -> "£19.99"
   *   formatPenceAsGBP(null)     -> "—"
   */
  export function formatPenceAsGBP(
    pence: number | null | undefined,
    opts?: {
      /** override the placeholder for null/undefined (default "—") */
      nullAs?: string;
      /** override zero display (e.g., "£0.00" by default) */
      zeroAs?: string;
      /** control decimals; defaults to 2/2 */
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    }
  ): string {
    if (pence == null) return opts?.nullAs ?? '—';
  
    const pounds = penceToPounds(pence);
  
    if (pounds === 0 && opts?.zeroAs !== undefined) {
      return opts.zeroAs;
    }
  
    const formatter = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: opts?.minimumFractionDigits ?? 2,
      maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
    });
  
    return formatter.format(pounds);
  }
  
  /**
   * (Optional) Convert pounds (number or numeric string) to pence (integer).
   * Useful for form inputs that capture "19.99" and you need 1999 for the API.
   */
  export function poundsToPence(input: number | string): number {
    const n =
      typeof input === 'number'
        ? input
        : Number(String(input).trim().replace(/[, ]/g, ''));
    if (!Number.isFinite(n)) throw new Error('Invalid pounds value');
    // Round to avoid floating point issues (e.g., 19.99 * 100 = 1998.999...)
    return Math.round(n * 100);
  }
  