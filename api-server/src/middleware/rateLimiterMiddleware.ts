import type { Request, Response, NextFunction } from 'express'

type BucketKey = string
type Bucket = { remaining: number; resetAtUnixMs: number }

const buckets = new Map<BucketKey, Bucket>()

export function createFixedWindowRateLimiterMiddleware(options: {
  windowSeconds: number
  limit: number
  bucketScope: 'ip' | 'session' | 'ip+session'
}) {
  const windowMs = options.windowSeconds * 1000

  return function rateLimiter(request: Request, response: Response, next: NextFunction) {
    const ipKey = request.ip || request.socket.remoteAddress || 'unknown'
    const sessionKey = (request as any).currentUserId ?? 'anon'
    const compositeKey =
      options.bucketScope === 'ip' ? ipKey :
      options.bucketScope === 'session' ? sessionKey :
      `${ipKey}:${sessionKey}`

    const now = Date.now()
    const bucket = buckets.get(compositeKey)

    if (!bucket || bucket.resetAtUnixMs <= now) {
      buckets.set(compositeKey, { remaining: options.limit - 1, resetAtUnixMs: now + windowMs })
      setHeaders(response, options.limit - 1, options.limit, now + windowMs)
      return next()
    }

    if (bucket.remaining > 0) {
      bucket.remaining -= 1
      setHeaders(response, bucket.remaining, options.limit, bucket.resetAtUnixMs)
      return next()
    }

    setHeaders(response, 0, options.limit, bucket.resetAtUnixMs)
    return response.status(429).json({
      success: false,
      data: null,
      error: {
        errorCode: 'RATE_LIMITED',
        httpStatusCode: 429,
        userFacingMessage: 'Too many requests. Please try again later.',
        developerMessage: 'Rate limit exceeded.',
        correlationId: (request as any).correlationId ?? null,
      }
    })
  }
}

function setHeaders(res: Response, remaining: number, limit: number, resetAtUnixMs: number) {
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(remaining, 0)))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAtUnixMs / 1000)))
}
