// api-server/src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express'
import { HttpError } from '../utils/httpErrors.js'
import { pinoLoggerInstance } from '../logger/logger.js'

export function standardErrorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  const correlationId = (request as any).correlationId ?? null

  if (error instanceof HttpError) {
    // optional: structured log for expected HttpError at warn level
    pinoLoggerInstance.warn(
      { correlationId, errorCode: error.errorCode, httpStatusCode: error.httpStatusCode },
      `Handled HttpError: ${error.errorCode}`
    )
    return response.status(error.httpStatusCode).json({
      success: false,
      data: null,
      error: {
        errorCode: error.errorCode,
        httpStatusCode: error.httpStatusCode,
        userFacingMessage: error.userFacingMessage,
        developerMessage: error.developerMessage,
        correlationId,
      },
    })
  }

  // Unexpected error — log full detail
  pinoLoggerInstance.error({ correlationId, err: error }, 'Unhandled error')

  return response.status(500).json({
    success: false,
    data: null,
    error: {
      errorCode: 'INTERNAL_ERROR',
      httpStatusCode: 500,
      userFacingMessage: 'Unexpected error occurred.',
      developerMessage: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
    },
  })
}
