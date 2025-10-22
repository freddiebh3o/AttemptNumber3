// api-server/src/middleware/rateLimiterMiddleware.ts
import type { Request, Response, NextFunction } from "express";

type BucketKey = string;
type Bucket = { remaining: number; resetAtUnixMs: number };

const buckets = new Map<BucketKey, Bucket>();
let lastSweep = Date.now();

function maybeSweep(now: number) {
  // sweep at most once/min
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAtUnixMs <= now) buckets.delete(key);
  }
}

export function createFixedWindowRateLimiterMiddleware(options: {
  windowSeconds: number;
  limit: number;
  bucketScope: "ip" | "session" | "ip+session";
  name?: string;
  skip?: (req: Request) => boolean;
  disabled?: boolean; // NEW: Allow completely disabling rate limiting
}) {
  const windowMs = options.windowSeconds * 1000;

  return function rateLimiter(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    // NEW: Early return if rate limiting is disabled (e.g., in test environments)
    if (options.disabled) {
      return next();
    }

    // Skip OPTIONS (CORS preflight), health, and docs/openapi
    if (
      request.method === "OPTIONS" ||
      request.path === "/api/health" ||
      request.path === "/openapi.json" ||
      request.path === "/docs" ||
      request.path.startsWith("/docs/")
    ) {
      return next();
    }

    if (options.skip && options.skip(request)) {
      return next();
    }

    const now = Date.now();
    maybeSweep(now);

    const ipKey = request.ip || request.socket.remoteAddress || "unknown";
    const sessionKey = request.currentUserId ?? "anon";
    const compositeKey =
      options.bucketScope === "ip"
        ? ipKey
        : options.bucketScope === "session"
        ? sessionKey
        : `${ipKey}:${sessionKey}`;

    const bucket = buckets.get(compositeKey);

    if (!bucket || bucket.resetAtUnixMs <= now) {
      const resetAt = now + windowMs;
      buckets.set(compositeKey, {
        remaining: options.limit - 1,
        resetAtUnixMs: resetAt,
      });
      setHeaders(response, options.limit - 1, options.limit, resetAt, now, options.name);
      return next();
    }

    if (bucket.remaining > 0) {
      bucket.remaining -= 1;
      setHeaders(response, bucket.remaining, options.limit, bucket.resetAtUnixMs, now, options.name);
      return next();
    }

    setHeaders(response, 0, options.limit, bucket.resetAtUnixMs, now, options.name);
    return response.status(429).json({
      success: false,
      data: null,
      error: {
        errorCode: "RATE_LIMITED",
        httpStatusCode: 429,
        userFacingMessage: "Too many requests. Please try again later.",
        developerMessage: "Rate limit exceeded.",
        correlationId: request.correlationId ?? null,
      },
    });
  };
}

function setHeaders(
  res: Response,
  remaining: number,
  limit: number,
  resetAtUnixMs: number,
  nowMs: number,
  sourceName?: string 
) {
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(remaining, 0)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAtUnixMs / 1000)));
  if (sourceName) res.setHeader("X-RateLimit-Source", sourceName);

  const retryAfterSec = Math.max(0, Math.ceil((resetAtUnixMs - nowMs) / 1000));
  res.setHeader("Retry-After", String(retryAfterSec));
}