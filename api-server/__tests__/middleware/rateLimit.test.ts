// api-server/__tests__/middleware/rateLimit.test.ts
/**
 * [ST-012] Rate Limiter Middleware Tests
 *
 * Tests the fixed-window rate limiter middleware that prevents request abuse.
 *
 * Key behaviors tested:
 * - Fixed window rate limiting (limit per time window)
 * - Different bucket scopes (ip, session, ip+session)
 * - Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 * - 429 RATE_LIMITED error when limit exceeded
 * - Window reset after expiration
 * - Skip patterns (health, OPTIONS)
 */

import request from 'supertest';
import express from 'express';
import type { Express } from 'express';
import { createFixedWindowRateLimiterMiddleware } from '../../src/middleware/rateLimiterMiddleware.js';
import { requestIdMiddleware } from '../../src/middleware/requestIdMiddleware.js';

describe('[ST-012] Rate Limiter Middleware', () => {
  let app: Express;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(requestIdMiddleware); // For correlationId in error responses
  });

  afterEach(() => {
    // Add delay to let bucket windows potentially expire between tests
    // Note: The rate limiter uses an in-memory Map that persists across tests
    // Tests use unique paths to avoid interference
    return new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe('[AC-012-1] Fixed Window Rate Limiting', () => {
    it('should allow requests within the limit', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-1';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 5,
          bucketScope: 'session', // Use session scope with unique user ID
        })
      );
      app.get('/test-allow-within-limit', (req, res) => res.json({ success: true }));

      // Make 5 requests (all should succeed)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test-allow-within-limit');
        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('5');
        expect(response.headers['x-ratelimit-remaining']).toBe(String(4 - i));
      }
    });

    it('should return 429 when limit is exceeded', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-2';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 3,
          bucketScope: 'session',
        })
      );
      app.get('/test-429-limit', (req, res) => res.json({ success: true }));

      // Make 3 requests (all should succeed)
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/test-429-limit');
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const response = await request(app).get('/test-429-limit');
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('RATE_LIMITED');
      expect(response.body.error?.userFacingMessage).toContain('Too many requests');
      expect(response.body.error?.correlationId).toBeDefined();
    });

    it('should set correct rate limit headers', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-3';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 10,
          bucketScope: 'session',
          name: 'test-limiter',
        })
      );
      app.get('/test-headers', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test-headers');

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('9');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['x-ratelimit-source']).toBe('test-limiter');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should set Retry-After header when rate limited', async () => {
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 1,
          bucketScope: 'ip',
        })
      );
      app.get('/test-retry-after', (req, res) => res.json({ success: true }));

      // First request succeeds
      await request(app).get('/test-retry-after');

      // Second request is rate limited
      const response = await request(app).get('/test-retry-after');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      const retryAfter = parseInt(response.headers['retry-after'] || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('[AC-012-2] Bucket Scoping', () => {
    it('should scope by session (bucketScope: "session")', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'user-123';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 2,
          bucketScope: 'session',
        })
      );
      app.get('/test-scope-session', (req, res) => res.json({ success: true }));

      // Make 2 requests from same session
      const res1 = await request(app).get('/test-scope-session');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test-scope-session');
      expect(res2.status).toBe(200);

      // 3rd request from same session should be rate limited
      const res3 = await request(app).get('/test-scope-session');
      expect(res3.status).toBe(429);
    });

    it('should scope by IP+session (bucketScope: "ip+session")', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'user-456';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 2,
          bucketScope: 'ip+session',
        })
      );
      app.get('/test-scope-ip-session', (req, res) => res.json({ success: true }));

      // Make 2 requests from same IP+session
      const res1 = await request(app).get('/test-scope-ip-session');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test-scope-ip-session');
      expect(res2.status).toBe(200);

      // 3rd request should be rate limited
      const res3 = await request(app).get('/test-scope-ip-session');
      expect(res3.status).toBe(429);
    });

    it('should treat anonymous users as separate bucket (session scope)', async () => {
      app.use((req, res, next) => {
        // No currentUserId set (anonymous)
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 2,
          bucketScope: 'session',
        })
      );
      app.get('/test-scope-anon', (req, res) => res.json({ success: true }));

      // Make 2 anonymous requests
      const res1 = await request(app).get('/test-scope-anon');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test-scope-anon');
      expect(res2.status).toBe(200);

      // 3rd anonymous request should be rate limited
      const res3 = await request(app).get('/test-scope-anon');
      expect(res3.status).toBe(429);
    });
  });

  describe('[AC-012-3] Skip Patterns', () => {
    beforeEach(() => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-skip-patterns';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 1, // Very low limit to test skipping
          bucketScope: 'session',
        })
      );
      app.get('/test-regular-limit', (req, res) => res.json({ success: true }));
      app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
      app.get('/openapi.json', (req, res) => res.json({ openapi: '3.0.0' }));
      app.get('/docs', (req, res) => res.send('docs'));
      app.options('/test-options', (req, res) => res.sendStatus(204));
    });

    it('should skip rate limiting for OPTIONS requests (CORS preflight)', async () => {
      // Make multiple OPTIONS requests (should not be rate limited)
      const res1 = await request(app).options('/test-options');
      expect(res1.status).toBe(204);

      const res2 = await request(app).options('/test-options');
      expect(res2.status).toBe(204);

      const res3 = await request(app).options('/test-options');
      expect(res3.status).toBe(204);
    });

    it('should skip rate limiting for /api/health', async () => {
      // Make multiple health check requests (should not be rate limited)
      const res1 = await request(app).get('/api/health');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/api/health');
      expect(res2.status).toBe(200);

      const res3 = await request(app).get('/api/health');
      expect(res3.status).toBe(200);
    });

    it('should skip rate limiting for /openapi.json', async () => {
      const res1 = await request(app).get('/openapi.json');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/openapi.json');
      expect(res2.status).toBe(200);
    });

    it('should skip rate limiting for /docs paths', async () => {
      const res1 = await request(app).get('/docs');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/docs');
      expect(res2.status).toBe(200);
    });

    it('should apply rate limiting to regular endpoints', async () => {
      // First request succeeds
      const res1 = await request(app).get('/test-regular-limit');
      expect(res1.status).toBe(200);

      // Second request is rate limited (limit is 1)
      const res2 = await request(app).get('/test-regular-limit');
      expect(res2.status).toBe(429);
    });

    it('should respect custom skip function', async () => {
      const appWithCustomSkip = express();
      appWithCustomSkip.use(requestIdMiddleware);
      appWithCustomSkip.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-custom-skip';
        next();
      });
      appWithCustomSkip.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 1,
          bucketScope: 'session',
          skip: (req) => req.path === '/admin/bypass',
        })
      );
      appWithCustomSkip.get('/test-custom-skip', (req, res) => res.json({ success: true }));
      appWithCustomSkip.get('/admin/bypass', (req, res) => res.json({ success: true }));

      // /admin/bypass should not be rate limited
      const res1 = await request(appWithCustomSkip).get('/admin/bypass');
      expect(res1.status).toBe(200);

      const res2 = await request(appWithCustomSkip).get('/admin/bypass');
      expect(res2.status).toBe(200);

      // /test-custom-skip should be rate limited
      const res3 = await request(appWithCustomSkip).get('/test-custom-skip');
      expect(res3.status).toBe(200);

      const res4 = await request(appWithCustomSkip).get('/test-custom-skip');
      expect(res4.status).toBe(429);
    });
  });

  describe('[AC-012-4] Window Reset', () => {
    it('should reset bucket after window expires', async () => {
      // Use very short window for testing (1 second)
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-window-reset';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 1,
          limit: 2,
          bucketScope: 'session',
        })
      );
      app.get('/test-window-reset', (req, res) => res.json({ success: true }));

      // Make 2 requests (both should succeed)
      const res1 = await request(app).get('/test-window-reset');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test-window-reset');
      expect(res2.status).toBe(200);

      // 3rd request should be rate limited
      const res3 = await request(app).get('/test-window-reset');
      expect(res3.status).toBe(429);

      // Wait for window to expire (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // New request should succeed (bucket reset)
      const res4 = await request(app).get('/test-window-reset');
      expect(res4.status).toBe(200);
      expect(res4.headers['x-ratelimit-remaining']).toBe('1');
    });

    it('should update X-RateLimit-Reset header correctly', async () => {
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 5,
          bucketScope: 'ip',
        })
      );
      app.get('/test-reset-header', (req, res) => res.json({ success: true }));

      const beforeTime = Math.floor(Date.now() / 1000);
      const response = await request(app).get('/test-reset-header');
      const afterTime = Math.floor(Date.now() / 1000);

      const resetTime = parseInt(response.headers['x-ratelimit-reset'] || '0', 10);

      // Reset time should be approximately current time + 60 seconds
      expect(resetTime).toBeGreaterThanOrEqual(beforeTime + 59);
      expect(resetTime).toBeLessThanOrEqual(afterTime + 61);
    });
  });

  describe('[AC-012-5] Headers on Rate Limited Responses', () => {
    it('should set all rate limit headers on 429 response', async () => {
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 1,
          bucketScope: 'ip',
        })
      );
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request (succeeds)
      await request(app).get('/test');

      // Second request (rate limited)
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.headers['x-ratelimit-limit']).toBe('1');
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should include correlationId in rate limit error', async () => {
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 1,
          bucketScope: 'ip',
        })
      );
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request
      await request(app).get('/test');

      // Second request (rate limited)
      const response = await request(app).get('/test');

      expect(response.status).toBe(429);
      expect(response.body.error?.correlationId).toBeDefined();
      expect(typeof response.body.error?.correlationId).toBe('string');
    });
  });

  describe('[AC-012-6] Rate Limit Bypass (disabled option)', () => {
    it('should bypass rate limiting when disabled=true', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-disabled';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 1, // Very low limit
          bucketScope: 'session',
          disabled: true, // Rate limiting disabled
        })
      );
      app.get('/test-disabled', (req, res) => res.json({ success: true }));

      // Make many requests (all should succeed despite limit of 1)
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test-disabled');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Should not have rate limit headers when disabled
        expect(response.headers['x-ratelimit-limit']).toBeUndefined();
        expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
      }
    });

    it('should apply rate limiting when disabled=false (default)', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-enabled';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 2,
          bucketScope: 'session',
          disabled: false, // Explicitly enabled
        })
      );
      app.get('/test-enabled', (req, res) => res.json({ success: true }));

      // First 2 requests succeed
      const res1 = await request(app).get('/test-enabled');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test-enabled');
      expect(res2.status).toBe(200);

      // 3rd request is rate limited
      const res3 = await request(app).get('/test-enabled');
      expect(res3.status).toBe(429);
      expect(res3.body.error?.errorCode).toBe('RATE_LIMITED');
    });

    it('should apply rate limiting when disabled is undefined (default behavior)', async () => {
      app.use((req, res, next) => {
        req.currentUserId = 'rate-limit-test-user-default';
        next();
      });
      app.use(
        createFixedWindowRateLimiterMiddleware({
          windowSeconds: 60,
          limit: 2,
          bucketScope: 'session',
          // disabled not specified (should default to rate limiting enabled)
        })
      );
      app.get('/test-default', (req, res) => res.json({ success: true }));

      // First 2 requests succeed
      const res1 = await request(app).get('/test-default');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test-default');
      expect(res2.status).toBe(200);

      // 3rd request is rate limited
      const res3 = await request(app).get('/test-default');
      expect(res3.status).toBe(429);
    });
  });
});
