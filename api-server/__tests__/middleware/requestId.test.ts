// api-server/__tests__/middleware/requestId.test.ts
/**
 * [MIDDLEWARE-REQUESTID] Request ID Middleware Tests
 *
 * Tests the request ID middleware that generates and propagates correlation IDs
 * for request tracing and debugging.
 *
 * Key behaviors tested:
 * - Generates UUIDv4 correlationId for each request
 * - Sets correlationId on request object (req.correlationId)
 * - Respects existing X-Request-Id header if present
 * - Respects existing X-Correlation-Id header if present
 * - Unique IDs for concurrent requests (no collisions)
 * - CorrelationId available to error handler and downstream middleware
 */

import request from 'supertest';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../../src/middleware/requestIdMiddleware.js';

describe('[MIDDLEWARE-REQUESTID] Request ID Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(requestIdMiddleware);
  });

  describe('CorrelationId Generation', () => {
    it('should set correlationId on request object', async () => {
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(capturedCorrelationId).toBeDefined();
      expect(typeof capturedCorrelationId).toBe('string');
      expect(capturedCorrelationId!.length).toBeGreaterThan(0);
    });

    it('should generate valid UUIDv4 format', async () => {
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test');

      // UUIDv4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidv4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(capturedCorrelationId).toMatch(uuidv4Regex);
    });

    it('should generate unique IDs for different requests', async () => {
      const correlationIds: string[] = [];

      app.get('/test', (req: Request, res: Response) => {
        correlationIds.push(req.correlationId!);
        res.json({ success: true });
      });

      // Make multiple concurrent requests
      await Promise.all([
        request(app).get('/test'),
        request(app).get('/test'),
        request(app).get('/test'),
        request(app).get('/test'),
        request(app).get('/test'),
      ]);

      // All IDs should be unique
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Existing Header Handling', () => {
    it('should respect existing X-Request-Id header', async () => {
      const existingId = 'custom-request-id-123';
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-Request-Id', existingId);

      expect(capturedCorrelationId).toBe(existingId);
    });

    it('should respect existing X-Correlation-Id header', async () => {
      const existingId = 'custom-correlation-id-456';
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-Correlation-Id', existingId);

      expect(capturedCorrelationId).toBe(existingId);
    });

    it('should prioritize X-Request-Id over X-Correlation-Id', async () => {
      const requestId = 'x-request-id-789';
      const correlationId = 'x-correlation-id-999';
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app)
        .get('/test')
        .set('X-Request-Id', requestId)
        .set('X-Correlation-Id', correlationId);

      // X-Request-Id should take precedence
      expect(capturedCorrelationId).toBe(requestId);
    });
  });

  describe('Middleware Integration', () => {
    it('should make correlationId available to downstream middleware', async () => {
      let correlationIdInMiddleware: string | undefined;
      let correlationIdInHandler: string | undefined;

      // Add a downstream middleware
      app.use((req: Request, res: Response, next: NextFunction) => {
        correlationIdInMiddleware = req.correlationId;
        next();
      });

      app.get('/test', (req: Request, res: Response) => {
        correlationIdInHandler = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(correlationIdInMiddleware).toBeDefined();
      expect(correlationIdInHandler).toBeDefined();
      expect(correlationIdInMiddleware).toBe(correlationIdInHandler);
    });

    it('should make correlationId available to error handler', async () => {
      let correlationIdInErrorHandler: string | undefined;

      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(new Error('Test error'));
      });

      // Error handler
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        correlationIdInErrorHandler = req.correlationId;
        res.status(500).json({ error: err.message, correlationId: req.correlationId });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(correlationIdInErrorHandler).toBeDefined();
      expect(response.body.correlationId).toBeDefined();
      expect(response.body.correlationId).toBe(correlationIdInErrorHandler);
    });

    it('should work with concurrent requests without collisions', async () => {
      const requestCorrelationIds: string[] = [];

      app.get('/test', (req: Request, res: Response) => {
        requestCorrelationIds.push(req.correlationId!);
        res.json({ correlationId: req.correlationId });
      });

      // Make 10 concurrent requests
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => request(app).get('/test'))
      );

      // All correlation IDs should be unique
      const uniqueIds = new Set(requestCorrelationIds);
      expect(uniqueIds.size).toBe(10);

      // Each response should have its own unique correlation ID
      const responseIds = responses.map((res) => res.body.correlationId);
      const uniqueResponseIds = new Set(responseIds);
      expect(uniqueResponseIds.size).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty X-Request-Id header by generating new ID', async () => {
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-Request-Id', '');

      // Should generate new UUID since header is empty
      expect(capturedCorrelationId).toBeDefined();
      const uuidv4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(capturedCorrelationId).toMatch(uuidv4Regex);
    });

    it('should handle whitespace-only X-Request-Id header by generating new ID', async () => {
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-Request-Id', '   ');

      // Express/supertest trims whitespace headers or treats them as empty
      // So '   ' becomes falsy and a new UUID is generated
      expect(capturedCorrelationId).toBeDefined();
      const uuidv4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(capturedCorrelationId).toMatch(uuidv4Regex);
    });

    it('should work with different HTTP methods', async () => {
      const correlationIds: string[] = [];

      app.post('/test', (req: Request, res: Response) => {
        correlationIds.push(req.correlationId!);
        res.json({ success: true });
      });

      app.put('/test', (req: Request, res: Response) => {
        correlationIds.push(req.correlationId!);
        res.json({ success: true });
      });

      app.delete('/test', (req: Request, res: Response) => {
        correlationIds.push(req.correlationId!);
        res.json({ success: true });
      });

      await request(app).post('/test');
      await request(app).put('/test');
      await request(app).delete('/test');

      expect(correlationIds).toHaveLength(3);
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
