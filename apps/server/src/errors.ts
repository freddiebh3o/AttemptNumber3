export class AppError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, "BAD_REQUEST", details);
export const unauthorized = (msg = "Unauthorized") =>
  new AppError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Forbidden") =>
  new AppError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not Found") =>
  new AppError(404, msg, "NOT_FOUND");
