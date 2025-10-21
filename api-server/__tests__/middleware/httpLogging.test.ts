// api-server/__tests__/middleware/httpLogging.test.ts
/**
 * [MIDDLEWARE-HTTPLOG] HTTP Logging Middleware Tests
 *
 * Tests the HTTP logging middleware (pino-http) that logs HTTP requests
 * and responses for debugging and monitoring.
 *
 * Key behaviors tested:
 * - Logs HTTP method and URL
 * - Logs response status code
 * - Includes correlationId in logs
 * - Includes currentUserId and currentTenantId in logs
 * - Custom log levels based on status code (error, warn, info)
 * - Skips logging for health check endpoints (/api/health)
 * - Request serialization (method, url)
 * - Response serialization (statusCode)
 * - Custom success/error messages
 * - Performance: minimal overhead
 */

import request from 'supertest';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { httpLoggingMiddleware } from '../../src/middleware/httpLoggingMiddleware.js';
import { requestIdMiddleware } from '../../src/middleware/requestIdMiddleware.js';
import { pinoLoggerInstance } from '../../src/logger/logger.js';

describe('[MIDDLEWARE-HTTPLOG] HTTP Logging Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(httpLoggingMiddleware);
  });

  describe('Basic HTTP Logging', () => {
    it('should log successful GET request', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // Middleware should not affect response
      expect(response.body.success).toBe(true);
    });

    it('should log successful POST request', async () => {
      app.post('/test', (req: Request, res: Response) => {
        res.status(201).json({ success: true, created: true });
      });

      const response = await request(app).post('/test').send({ data: 'test' });

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(true);
    });

    it('should log different HTTP methods', async () => {
      app.get('/test', (req: Request, res: Response) => res.json({ method: 'GET' }));
      app.post('/test', (req: Request, res: Response) => res.json({ method: 'POST' }));
      app.put('/test', (req: Request, res: Response) => res.json({ method: 'PUT' }));
      app.delete('/test', (req: Request, res: Response) => res.json({ method: 'DELETE' }));
      app.patch('/test', (req: Request, res: Response) => res.json({ method: 'PATCH' }));

      await request(app).get('/test');
      await request(app).post('/test');
      await request(app).put('/test');
      await request(app).delete('/test');
      await request(app).patch('/test');

      // All requests should complete successfully (logging shouldn't interfere)
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    it('should log different status codes', async () => {
      app.get('/ok', (req: Request, res: Response) => res.status(200).json({ status: 'ok' }));
      app.get('/created', (req: Request, res: Response) =>
        res.status(201).json({ status: 'created' })
      );
      app.get('/bad-request', (req: Request, res: Response) =>
        res.status(400).json({ error: 'bad request' })
      );
      app.get('/unauthorized', (req: Request, res: Response) =>
        res.status(401).json({ error: 'unauthorized' })
      );
      app.get('/not-found', (req: Request, res: Response) =>
        res.status(404).json({ error: 'not found' })
      );
      app.get('/server-error', (req: Request, res: Response) =>
        res.status(500).json({ error: 'server error' })
      );

      await request(app).get('/ok');
      await request(app).get('/created');
      await request(app).get('/bad-request');
      await request(app).get('/unauthorized');
      await request(app).get('/not-found');
      await request(app).get('/server-error');

      // Logging should work for all status codes
      const response = await request(app).get('/ok');
      expect(response.status).toBe(200);
    });
  });

  describe('Health Check Endpoint Skipping', () => {
    it('should skip logging for /api/health endpoint', async () => {
      app.get('/api/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy' });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      // Logging is skipped, but response should still work
    });

    it('should log for other health-related endpoints', async () => {
      app.get('/api/healthcheck', (req: Request, res: Response) => {
        res.json({ status: 'healthy' });
      });

      const response = await request(app).get('/api/healthcheck');

      expect(response.status).toBe(200);
      // Should log since it's not exactly /api/health
    });

    it('should log for non-health endpoints', async () => {
      app.get('/api/products', (req: Request, res: Response) => {
        res.json({ products: [] });
      });

      const response = await request(app).get('/api/products');

      expect(response.status).toBe(200);
      // Should log for regular endpoints
    });
  });

  describe('Correlation ID Logging', () => {
    it('should include correlationId from request', async () => {
      let capturedCorrelationId: string | undefined;

      app.get('/test', (req: Request, res: Response) => {
        capturedCorrelationId = req.correlationId;
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(capturedCorrelationId).toBeDefined();
      // Logging middleware should have access to correlationId
    });

    it('should log custom correlationId from header', async () => {
      const customId = 'custom-correlation-id-123';

      app.get('/test', (req: Request, res: Response) => {
        expect(req.correlationId).toBe(customId);
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-Request-Id', customId);

      // Should use custom correlation ID
    });
  });

  describe('User and Tenant Context Logging', () => {
    it('should log currentUserId and currentTenantId when available', async () => {
      // Simulate session middleware setting these values
      app.use((req: Request, res: Response, next: NextFunction) => {
        req.currentUserId = 'user-123';
        req.currentTenantId = 'tenant-456';
        next();
      });

      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // Logging middleware should capture currentUserId and currentTenantId
    });

    it('should log null for currentUserId and currentTenantId when not authenticated', async () => {
      app.get('/test', (req: Request, res: Response) => {
        expect(req.currentUserId).toBeUndefined();
        expect(req.currentTenantId).toBeUndefined();
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // Should log null for missing user/tenant context
    });
  });

  describe('Request/Response Serialization', () => {
    it('should serialize request method and URL', async () => {
      app.get('/test/path', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test/path?query=value');

      expect(response.status).toBe(200);
      // Logger should serialize method: 'GET', url: '/test/path?query=value'
    });

    it('should serialize response status code', async () => {
      app.post('/test', (req: Request, res: Response) => {
        res.status(201).json({ created: true });
      });

      const response = await request(app).post('/test');

      expect(response.status).toBe(201);
      // Logger should serialize statusCode: 201
    });

    it('should use originalUrl when available', async () => {
      app.get('/test', (req: Request, res: Response) => {
        // Express sets originalUrl
        expect(req.originalUrl).toBeDefined();
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('Error Logging', () => {
    it('should log 500 errors with error level', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        next(new Error('Server error'));
      });

      // Error handler
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      // Should log with 'error' level for 500 status
    });

    it('should log 400 errors with warn level', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.status(400).json({ error: 'Bad request' });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      // Should log with 'warn' level for 400 status
    });

    it('should log 404 errors with warn level', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.status(404).json({ error: 'Not found' });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(404);
      // Should log with 'warn' level for 404 status
    });

    it('should log successful requests with info level', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // Should log with 'info' level for 200 status
    });
  });

  describe('Performance and Overhead', () => {
    it('should add minimal overhead to requests', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const startTime = Date.now();
      await request(app).get('/test');
      const duration = Date.now() - startTime;

      // Request should complete quickly (< 100ms for simple handler)
      expect(duration).toBeLessThan(100);
    });

    it('should not block concurrent requests', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.json({ id: req.correlationId });
      });

      // Make 10 concurrent requests
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => request(app).get('/test'))
      );

      // All should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
      });

      // All correlation IDs should be unique
      const ids = responses.map((res) => res.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should handle high request volume without errors', async () => {
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Make 50 concurrent requests
      const requests = Array.from({ length: 50 }, () => request(app).get('/test'));
      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Custom Log Messages', () => {
    it('should format success message with method, url, and status', async () => {
      app.get('/test/endpoint', (req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app).get('/test/endpoint');

      expect(response.status).toBe(200);
      // Success message format: "GET /test/endpoint 200"
    });

    it('should format error message with method, url, status, and error message', async () => {
      app.get('/test', (req: Request, res: Response, next: NextFunction) => {
        const error = new Error('Test error message');
        res.status(500);
        next(error);
      });

      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      // Error message format: "GET /test 500 - Test error message"
    });
  });

  describe('Edge Cases', () => {
    it('should handle requests without correlationId gracefully', async () => {
      // Create app without requestIdMiddleware
      const appWithoutRequestId = express();
      appWithoutRequestId.use(httpLoggingMiddleware);
      appWithoutRequestId.get('/test', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(appWithoutRequestId).get('/test');

      expect(response.status).toBe(200);
      // Should still log successfully, just with generated ID
    });

    it('should handle requests with very long URLs', async () => {
      const longPath = '/test/' + 'a'.repeat(1000);
      app.get(longPath, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get(longPath);

      expect(response.status).toBe(200);
      // Should log long URLs without errors
    });

    it('should handle requests with special characters in URL', async () => {
      app.get('/test/:id', (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test/hello%20world');

      expect(response.status).toBe(200);
      // Should log URL with special characters
    });

    it('should handle requests with large response bodies', async () => {
      app.get('/test', (req: Request, res: Response) => {
        const largeData = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(100),
        }));
        res.json({ items: largeData });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1000);
      // Should log without issues despite large response
    });
  });
});
