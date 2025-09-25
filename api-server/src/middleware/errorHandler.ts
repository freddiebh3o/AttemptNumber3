import type { Request, Response, NextFunction } from 'express'
import { HttpError } from '../utils/httpErrors.js'
import { type StandardErrorResponse } from '../utils/standardResponse.js'

export function standardErrorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  const correlationIdValue: string | null = (request as any).correlationId ?? null

  if (error instanceof HttpError) {
    const errorResponseBody: StandardErrorResponse = {
      success: false,
      data: null,
      error: {
        errorCode: error.errorCode,
        httpStatusCode: error.httpStatusCode,
        userFacingMessage: error.userFacingMessage,
        ...(error.developerMessage !== undefined && { developerMessage: error.developerMessage }),
        correlationId: correlationIdValue,
      }
    }
    return response.status(error.httpStatusCode).json(errorResponseBody)
  }

  // Fallback for unrecognized errors
  const errorResponseBody: StandardErrorResponse = {
    success: false,
    data: null,
    error: {
      errorCode: 'INTERNAL_ERROR',
      httpStatusCode: 500,
      userFacingMessage: 'Unexpected error occurred.',
      developerMessage: error instanceof Error ? error.message : String(error),
      correlationId: correlationIdValue,
    }
  }
  return response.status(500).json(errorResponseBody)
}
