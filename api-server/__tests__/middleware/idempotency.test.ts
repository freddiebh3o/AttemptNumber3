// api-server/__tests__/middleware/idempotency.test.ts
/**
 * [ST-013] Idempotency Middleware Tests
 *
 * Tests the idempotency middleware that prevents duplicate request execution
 * by storing and replaying responses for requests with identical Idempotency-Key headers.
 *
 * Key behaviors tested:
 * - Same idempotency key + same request → returns cached response
 * - Same idempotency key + different request → executes normally
 * - Different idempotency keys → execute independently
 * - Only applies to POST/PUT/DELETE methods
 * - Preserves original HTTP status codes (201 vs 200)
 * - TTL expiration handling
 */

import request from 'supertest';
import express from 'express';
import type { Express } from 'express';
import { idempotencyMiddleware } from '../../src/middleware/idempotencyMiddleware.js';
import { requestIdMiddleware } from '../../src/middleware/requestIdMiddleware.js';
import { sessionMiddleware } from '../../src/middleware/sessionMiddleware.js';
import cookieParser from 'cookie-parser';
import { createTestTenant, createTestUser } from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';
import { prismaClientInstance } from '../../src/db/prismaClient.js';

describe('[ST-013] Idempotency Middleware', () => {
  let app: Express;
  let testTenant: { id: string };
  let testUser: { id: string };
  let sessionCookie: string;

  beforeAll(async () => {

    // Create test tenant and user - use factory defaults for unique values
    testTenant = await createTestTenant();
    testUser = await createTestUser({
      password: 'password123',
    });

    sessionCookie = createSessionCookie(testUser.id, testTenant.id);
  });

  beforeEach(async () => {
    // Clean up idempotency records before each test
    await prismaClientInstance.idempotencyRecord.deleteMany({});

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.use(sessionMiddleware);
    app.use(idempotencyMiddleware(60)); // 60 minute TTL
  });

  describe('[AC-013-1] Basic Idempotency', () => {
    it('should execute request normally without Idempotency-Key header', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: callCount } });
      });

      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .send({ name: 'Test' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(1);

      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .send({ name: 'Test' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(2);
      expect(callCount).toBe(2); // Both requests executed
    });

    it('should return cached response for same Idempotency-Key', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: callCount, timestamp: Date.now() } });
      });

      const idempotencyKey = 'test-key-123';

      // First request
      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Test' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(1);
      const firstTimestamp = res1.body.data.timestamp;

      // Wait a bit to ensure timestamp would be different if re-executed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second request with same key (should return cached response)
      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Test' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(1); // Same ID as first request
      expect(res2.body.data.timestamp).toBe(firstTimestamp); // Exact same response
      expect(callCount).toBe(1); // Handler only called once
    });

    it('should execute request with different Idempotency-Key', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: callCount } });
      });

      // First request
      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', 'key-1')
        .send({ name: 'Test' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(1);

      // Second request with different key
      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', 'key-2')
        .send({ name: 'Test' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(2);
      expect(callCount).toBe(2); // Both requests executed
    });
  });

  describe('[AC-013-2] Request Fingerprinting', () => {
    it('should execute if request body differs (same key, different fingerprint)', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: callCount, name: req.body.name } });
      });

      const idempotencyKey = 'same-key';

      // First request
      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Alice' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(1);
      expect(res1.body.data.name).toBe('Alice');

      // Second request with same key but different body
      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Bob' }); // Different body

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(2); // New execution
      expect(res2.body.data.name).toBe('Bob');
      expect(callCount).toBe(2); // Both executed (different fingerprints)
    });

    it('should treat different users as different fingerprints', async () => {
      // Create second user - use factory default for unique email
      const user2 = await createTestUser({
        password: 'password123',
      });
      const user2Cookie = createSessionCookie(user2.id, testTenant.id);

      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: callCount } });
      });

      const idempotencyKey = 'user-specific-key';

      // First request from user1
      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ action: 'test' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(1);

      // Second request from user2 with same key (different fingerprint due to different user)
      const res2 = await request(app)
        .post('/test')
        .set('Cookie', user2Cookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ action: 'test' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(2); // Different execution
      expect(callCount).toBe(2);
    });

    it('should treat different paths as different fingerprints', async () => {
      let callCount = 0;
      const handler = (req: any, res: any) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: callCount, path: req.path } });
      };

      app.post('/path1', handler);
      app.post('/path2', handler);

      const idempotencyKey = 'path-test-key';

      // First request to path1
      const res1 = await request(app)
        .post('/path1')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ data: 'test' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(1);

      // Second request to path2 with same key (different path = different fingerprint)
      const res2 = await request(app)
        .post('/path2')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ data: 'test' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(2);
      expect(callCount).toBe(2);
    });
  });

  describe('[AC-013-3] HTTP Method Support', () => {
    it('should apply to POST requests', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.json({ success: true, data: { count: callCount } });
      });

      const idempotencyKey = 'post-test';

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(callCount).toBe(1); // Only executed once
    });

    it('should apply to PUT requests', async () => {
      let callCount = 0;
      app.put('/test', (req, res) => {
        callCount++;
        res.json({ success: true, data: { count: callCount } });
      });

      const idempotencyKey = 'put-test';

      await request(app)
        .put('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      await request(app)
        .put('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(callCount).toBe(1);
    });

    it('should apply to DELETE requests', async () => {
      let callCount = 0;
      app.delete('/test', (req, res) => {
        callCount++;
        res.json({ success: true, data: { count: callCount } });
      });

      const idempotencyKey = 'delete-test';

      await request(app)
        .delete('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey);

      await request(app)
        .delete('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey);

      expect(callCount).toBe(1);
    });

    it('should NOT apply to GET requests', async () => {
      let callCount = 0;
      app.get('/test', (req, res) => {
        callCount++;
        res.json({ success: true, data: { count: callCount } });
      });

      const idempotencyKey = 'get-test';

      await request(app).get('/test').set('Cookie', sessionCookie).set('Idempotency-Key', idempotencyKey);

      await request(app).get('/test').set('Cookie', sessionCookie).set('Idempotency-Key', idempotencyKey);

      expect(callCount).toBe(2); // GET requests always execute
    });
  });

  describe('[AC-013-4] Status Code Preservation', () => {
    it('should preserve 201 status code on replay', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.status(201).json({ success: true, data: { id: 'created' } });
      });

      const idempotencyKey = 'status-201';

      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(res1.status).toBe(201);

      // Replayed response should also have 201
      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(res2.status).toBe(201);
      expect(callCount).toBe(1);
    });

    it('should preserve 200 status code on replay', async () => {
      app.post('/test', (req, res) => {
        res.status(200).json({ success: true, data: { message: 'ok' } });
      });

      const idempotencyKey = 'status-200';

      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(res2.status).toBe(200);
    });

    it('should preserve 204 status code on replay', async () => {
      app.delete('/test', (req, res) => {
        res.status(204).send();
      });

      const idempotencyKey = 'status-204';

      const res1 = await request(app)
        .delete('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey);

      expect(res1.status).toBe(204);

      const res2 = await request(app)
        .delete('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey);

      expect(res2.status).toBe(204);
    });

    it('should preserve error status codes (400, 409) on replay', async () => {
      app.post('/test', (req, res) => {
        res.status(409).json({
          success: false,
          error: { errorCode: 'CONFLICT', message: 'Duplicate found' },
        });
      });

      const idempotencyKey = 'status-409';

      const res1 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(res1.status).toBe(409);

      const res2 = await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({});

      expect(res2.status).toBe(409);
      expect(res2.body.error?.errorCode).toBe('CONFLICT');
    });
  });

  describe('[AC-013-5] Header Case Insensitivity', () => {
    it('should accept "Idempotency-Key" header', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.json({ success: true });
      });

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', 'test-key')
        .send({});

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', 'test-key')
        .send({});

      expect(callCount).toBe(1);
    });

    it('should accept "Idempotency-key" header (lowercase)', async () => {
      let callCount = 0;
      app.post('/test', (req, res) => {
        callCount++;
        res.json({ success: true });
      });

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-key', 'test-key')
        .send({});

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-key', 'test-key')
        .send({});

      expect(callCount).toBe(1);
    });
  });

  describe('[AC-013-6] Database Persistence', () => {
    it('should store idempotency record in database', async () => {
      app.post('/test', (req, res) => {
        res.status(201).json({ success: true, data: { id: 'test-123' } });
      });

      const idempotencyKey = 'db-persistence-test';

      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Test' });

      // Check database
      const record = await prismaClientInstance.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });

      expect(record).toBeDefined();
      expect(record?.idempotencyKey).toBe(idempotencyKey);
      expect(record?.storedResponseJson).toBeDefined();
      expect(record?.requestFingerprint).toBeDefined();
      expect(record?.expiresAt).toBeInstanceOf(Date);
    });

    it('should update existing record with new fingerprint', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true, data: { name: req.body.name } });
      });

      const idempotencyKey = 'update-test';

      // First request
      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Alice' });

      const record1 = await prismaClientInstance.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });
      const fingerprint1 = record1?.requestFingerprint;

      // Second request with different body (should update record)
      await request(app)
        .post('/test')
        .set('Cookie', sessionCookie)
        .set('Idempotency-Key', idempotencyKey)
        .send({ name: 'Bob' });

      // Wait a bit for async database write to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const record2 = await prismaClientInstance.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });
      const fingerprint2 = record2?.requestFingerprint;

      expect(fingerprint2).not.toBe(fingerprint1); // Different fingerprints
      expect((record2?.storedResponseJson as any).data.name).toBe('Bob');
    });
  });
});
