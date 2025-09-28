import { notifications } from '@mantine/notifications';

export type PageError = Error & {
  httpStatusCode?: number;
  correlationId?: string;
  details?: unknown;
};

export function extractUserMessage(err: any, fallback = 'Something went wrong.'): string {
  // Your API shape: { success:false, error:{ userFacingMessage, httpStatusCode, correlationId, ... } }
  return (
    err?.details?.error?.userFacingMessage ||
    err?.details?.userFacingMessage ||
    err?.message ||
    fallback
  );
}

export function normalizePageError(err: any): PageError {
  const e: PageError =
    err instanceof Error ? (err as PageError) : Object.assign(new Error(String(err)), {});

  // Prefer server-provided fields
  const httpStatus =
    err?.httpStatusCode ??
    err?.status ??
    err?.details?.error?.httpStatusCode ??
    err?.details?.status;

  const corrId =
    err?.correlationId ??
    err?.details?.error?.correlationId ??
    err?.details?.correlationId;

  e.httpStatusCode = httpStatus;
  e.correlationId = corrId;
  if (e.details == null) e.details = err?.details ?? err;

  return e;
}

/**
 * Shows a toast (unless `silent`), and returns a normalized error for boundary throwing.
 */
export function handlePageError(err: any, opts?: { title?: string; silent?: boolean }): PageError {
  const message = extractUserMessage(err);
  if (!opts?.silent) {
    notifications.show({ color: 'red', title: opts?.title ?? 'Error', message });
  }
  return normalizePageError(err);
}
