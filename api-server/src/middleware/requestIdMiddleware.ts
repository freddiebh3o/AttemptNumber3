import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

export function requestIdMiddleware(request: Request, _response: Response, next: NextFunction) {
  ;(request as any).correlationId = randomUUID()
  next()
}
