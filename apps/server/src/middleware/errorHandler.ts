import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const code = isApp ? err.code ?? "ERROR" : "INTERNAL_SERVER_ERROR";
  const message = isApp ? err.message : "Internal Server Error";
  const details = isApp ? err.details : undefined;

  const log = {
    level: status >= 500 ? "error" : "warn",
    requestId: req.id,
    tenant: req.context?.tenantSlug,
    userId: req.context?.user?.id,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    message,
    details,
  };
  // Minimal logging for now:
  console[status >= 500 ? "error" : "warn"]("[http_error]", log);

  res.status(status).json({ error: message, code });
}
