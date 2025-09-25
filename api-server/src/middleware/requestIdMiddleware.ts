import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'

export function requestIdMiddleware(request: Request, _response: Response, next: NextFunction) {
  const existingHeaderCorrelationId = request.header('X-Request-Id') || request.header('X-Correlation-Id')
  ;(request as any).correlationId = existingHeaderCorrelationId || randomUUID()
  next()
}
