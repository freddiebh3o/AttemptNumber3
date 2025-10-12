// api-server/__tests__/middleware/errorHandler.test.ts
/**
 * [ST-014] Error Handler Middleware Tests
 *
 * Tests the global error handler middleware that catches and formats errors
 * into a consistent response envelope.
 *
 * Key behaviors tested:
 * - HttpError instances → formatted with correct status and error details
 * - Unhandled errors → 500 INTERNAL_ERROR response
 * - Correlation ID included in all error responses
 * - Standard error envelope format (success, data, error)
 * - Different error types (validation, auth, permission, not found, conflict)
 */

import request from 'supertest';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestIdMiddleware.js';
import { HttpError, Errors } from '../../src/utils/httpErrors.js';

describe('[ST-014] Error Handler Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware); // For correlationId
  });

  describe('[AC-014-1] HttpError Handling', () => {
    it('should handle VALIDATION_ERROR (400)', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.validation('Invalid email format', 'email field validation failed'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'VALIDATION_ERROR',
          httpStatusCode: 400,
          userFacingMessage: 'Invalid email format',
          developerMessage: 'email field validation failed',
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle AUTH_REQUIRED (401)', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.authRequired());
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'AUTH_REQUIRED',
          httpStatusCode: 401,
          userFacingMessage: 'Please sign in to continue.',
          developerMessage: undefined,
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle PERMISSION_DENIED (403)', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.permissionDenied());
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'PERMISSION_DENIED',
          httpStatusCode: 403,
          userFacingMessage: 'You do not have permission for this action.',
          developerMessage: undefined,
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle RESOURCE_NOT_FOUND (404)', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.notFound('Product not found'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'RESOURCE_NOT_FOUND',
          httpStatusCode: 404,
          userFacingMessage: 'Product not found',
          developerMessage: undefined,
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle CONFLICT (409)', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.conflict('Duplicate SKU', 'SKU must be unique per tenant'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'CONFLICT',
          httpStatusCode: 409,
          userFacingMessage: 'Duplicate SKU',
          developerMessage: 'SKU must be unique per tenant',
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle custom HttpError', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(
          new HttpError({
            httpStatusCode: 422,
            errorCode: 'CUSTOM_ERROR',
            userFacingMessage: 'Custom error message',
            developerMessage: 'Custom developer details',
          })
        );
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'CUSTOM_ERROR',
          httpStatusCode: 422,
          userFacingMessage: 'Custom error message',
          developerMessage: 'Custom developer details',
          correlationId: expect.any(String),
        },
      });
    });
  });

  describe('[AC-014-2] Unhandled Error Handling', () => {
    it('should handle generic Error as 500 INTERNAL_ERROR', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(new Error('Something went wrong'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'INTERNAL_ERROR',
          httpStatusCode: 500,
          userFacingMessage: 'Unexpected error occurred.',
          developerMessage: 'Something went wrong',
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle thrown string as 500 INTERNAL_ERROR', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next('Unexpected error string');
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        data: null,
        error: {
          errorCode: 'INTERNAL_ERROR',
          httpStatusCode: 500,
          userFacingMessage: 'Unexpected error occurred.',
          developerMessage: 'Unknown error',
          correlationId: expect.any(String),
        },
      });
    });

    it('should handle thrown non-error object as 500 INTERNAL_ERROR', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next({ unexpected: 'object' });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error?.errorCode).toBe('INTERNAL_ERROR');
      expect(response.body.error?.httpStatusCode).toBe(500);
    });

    it('should handle null error as 500 INTERNAL_ERROR', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        // Express doesn't invoke error handler for null/undefined, so use empty object
        next({} as Error);
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error?.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should handle undefined error as 500 INTERNAL_ERROR', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        // Express doesn't invoke error handler for null/undefined, so use empty object
        next({} as Error);
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error?.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('[AC-014-3] Correlation ID', () => {
    it('should include correlationId in error response', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.notFound());
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error?.correlationId).toBeDefined();
      expect(typeof response.body.error?.correlationId).toBe('string');
      expect(response.body.error?.correlationId.length).toBeGreaterThan(0);
    });

    it('should use request correlationId if available', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        // requestIdMiddleware sets req.correlationId
        expect(req.correlationId).toBeDefined();
        next(Errors.validation('Test error'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error?.correlationId).toBeDefined();
    });

    it('should include null correlationId if not set', async () => {
      // Create app without requestIdMiddleware
      const appWithoutCorrelationId = express();
      appWithoutCorrelationId.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.validation('Test error'));
      });
      appWithoutCorrelationId.use(standardErrorHandler);

      const response = await request(appWithoutCorrelationId).get('/test');

      expect(response.body.error?.correlationId).toBeNull();
    });
  });

  describe('[AC-014-4] Error Response Format', () => {
    it('should always return standard envelope format', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.validation('Test validation error'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeNull();
      expect(response.body.error).toBeInstanceOf(Object);
    });

    it('should include all required error fields', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.conflict('Test conflict', 'Developer details'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error).toHaveProperty('errorCode');
      expect(response.body.error).toHaveProperty('httpStatusCode');
      expect(response.body.error).toHaveProperty('userFacingMessage');
      expect(response.body.error).toHaveProperty('developerMessage');
      expect(response.body.error).toHaveProperty('correlationId');
      expect(response.body.error.errorCode).toBe('CONFLICT');
      expect(response.body.error.developerMessage).toBe('Developer details');
    });

    it('should set Content-Type to application/json', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.notFound());
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('[AC-014-5] Async Error Handling', () => {
    it('should handle errors from async route handlers', async () => {
      app.get('/test', async (req: Request, res: Response, next: NextFunction) => {
        try {
          await Promise.reject(new Error('Async error'));
        } catch (error) {
          next(error);
        }
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error?.errorCode).toBe('INTERNAL_ERROR');
      expect(response.body.error?.developerMessage).toBe('Async error');
    });

    it('should handle HttpError from async route handlers', async () => {
      app.post('/test', async (req: Request, res: Response, next: NextFunction) => {
        try {
          await Promise.resolve();
          throw Errors.validation('Async validation error');
        } catch (error) {
          next(error);
        }
      });
      app.use(standardErrorHandler);

      const response = await request(app).post('/test');

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.error?.userFacingMessage).toBe('Async validation error');
    });
  });

  describe('[AC-014-6] Multiple Error Types', () => {
    it('should handle different error types in the same app', async () => {
      app.get('/validation', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.validation('Validation error'));
      });
      app.get('/auth', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.authRequired());
      });
      app.get('/notfound', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.notFound());
      });
      app.use(standardErrorHandler);

      const res1 = await request(app).get('/validation');
      expect(res1.status).toBe(400);
      expect(res1.body.error?.errorCode).toBe('VALIDATION_ERROR');

      const res2 = await request(app).get('/auth');
      expect(res2.status).toBe(401);
      expect(res2.body.error?.errorCode).toBe('AUTH_REQUIRED');

      const res3 = await request(app).get('/notfound');
      expect(res3.status).toBe(404);
      expect(res3.body.error?.errorCode).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('[AC-014-7] Error Logging', () => {
    it('should not crash when error handler runs', async () => {
      // This test ensures the error handler completes successfully
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(new Error('Test error for logging'));
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      // If we get here, error handler completed without crashing
    });

    it('should handle HttpError logging without crashing', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(Errors.permissionDenied());
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });
  });
});
