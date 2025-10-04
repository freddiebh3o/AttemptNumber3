// src/middleware/requestLoggingMiddleware.ts
import { prismaClientInstance } from '../db/prismaClient.js';
import type { Request, Response, NextFunction } from 'express';

const MAX_BODY_LEN = 4000;
const SKIP_PATHS = new Set(['/api/health', '/openapi.json']);
const SKIP_PREFIXES = ['/docs', '/favicon', '/assets', '/static'];

function shouldSkip(path: string) {
  if (SKIP_PATHS.has(path)) return true;
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

function safeJson(x: unknown) {
  try { return JSON.stringify(maskSensitive(x)); } catch { return undefined; }
}

// Very light mask for common credential fields
function maskSensitive(val: any): any {
  if (val && typeof val === 'object') {
    const clone: any = Array.isArray(val) ? [] : {};
    for (const k of Object.keys(val)) {
      if (/(password|token|secret|authorization|apiKey)/i.test(k)) {
        clone[k] = '[REDACTED]';
      } else {
        clone[k] = maskSensitive(val[k]);
      }
    }
    return clone;
  }
  return val;
}

function truncate(s?: string | null, n = MAX_BODY_LEN) {
  if (!s) return s ?? undefined;
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function requestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.originalUrl || '';
    if (shouldSkip(path)) return next();

    const start = Date.now();

    const reqBodyStr = truncate(safeJson(req.body));
    const queryStr = truncate(req.url.includes('?') ? req.url.split('?')[1] : undefined);

    const xf = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(xf) ? xf[0] : typeof xf === 'string' ? xf.split(',')[0]?.trim() : undefined) ||
      (req.socket?.remoteAddress ?? undefined);

    const correlationId = (req as any).correlationId || req.headers['x-request-id'] || undefined;

    const origSend = res.send.bind(res);
    let resBodyStr: string | undefined;
    (res as any).send = (body: any) => {
      resBodyStr = truncate(typeof body === 'string' ? body : safeJson(body));
      return origSend(body);
    };

    res.on('finish', () => {
      const durationMs = Date.now() - start;

      // routeKey is more reliable after routing has finished
      const base = (req as any).baseUrl || '';
      const route = (req as any).route?.path || '';
      const routeKey = (base || route) ? `${req.method} ${base}${route}` : undefined;

      // IMPORTANT: coerce optionally-present scalars to null, not undefined
      void prismaClientInstance.apiRequestLog.create({
        data: {
          tenantId: ((req as any).currentTenantId ?? null),
          userId:   ((req as any).currentUserId ?? null),

          method: req.method,
          path,

          routeKey: (routeKey ?? null),
          query: (queryStr ?? null),
          ip: (ip ?? null),
          userAgent: ((req.headers['user-agent'] as string | undefined) ?? null),

          statusCode: res.statusCode,
          durationMs,

          errorCode: ((res.locals?.errorCode as string | undefined) ?? null),
          correlationId: ((correlationId as string | undefined) ?? null),

          reqBody: (reqBodyStr ?? null),
          resBody: (resBodyStr ?? null),
        },
      }).catch(() => { /* swallow logging errors */ });
    });

    next();
  };
}
