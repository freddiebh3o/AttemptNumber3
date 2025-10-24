// api-server/__tests__/middleware/zodValidation.test.ts
/**
 * [MIDDLEWARE-ZOD] Zod Validation Middleware Tests
 *
 * Tests the Zod validation middleware that validates request data
 * (body, query, params) against Zod schemas.
 *
 * Key behaviors tested:
 * - validateRequestBodyWithZod: Validates request body against schema
 * - validateRequestQueryWithZod: Validates query parameters against schema
 * - validateRequestParamsWithZod: Validates path parameters against schema
 * - Returns 400 VALIDATION_ERROR for invalid data
 * - Provides detailed validation error messages
 * - Sets validated data on request object (validatedBody, validatedQuery, validatedParams)
 * - Multiple validation errors reported together
 * - Works with nested objects and arrays
 */

import request from 'supertest';
import express from 'express';
import type { Express, Request, Response } from 'express';
import {
  validateRequestBodyWithZod,
  validateRequestQueryWithZod,
  validateRequestParamsWithZod,
} from '../../src/middleware/zodValidation.js';
import { standardErrorHandler } from '../../src/middleware/errorHandler.js';
import { requestIdMiddleware } from '../../src/middleware/requestIdMiddleware.js';
import { z } from 'zod';

describe('[MIDDLEWARE-ZOD] Zod Validation Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
  });

  describe('validateRequestBodyWithZod - Request Body Validation', () => {
    it('should validate valid request body and set validatedBody', async () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().int().positive(),
      });

      let capturedValidatedBody: any;

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        capturedValidatedBody = req.validatedBody;
        res.json({ success: true, data: req.validatedBody });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 'Alice', age: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(capturedValidatedBody).toEqual({ name: 'Alice', age: 30 });
    });

    it('should return 400 for invalid request body', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid-email', password: '123' }); // Invalid email and short password

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.error?.userFacingMessage).toBe('Invalid email address');
    });

    it('should provide detailed validation error messages', async () => {
      const schema = z.object({
        username: z.string().min(3),
        age: z.number().int().min(18),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({ username: 'ab', age: 15 }); // Too short username, too young

      expect(response.status).toBe(400);
      expect(response.body.error?.developerMessage).toContain('username');
      expect(response.body.error?.developerMessage).toContain('age');
    });

    it('should work with nested object schemas', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            street: z.string(),
            city: z.string(),
          }),
        }),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.validatedBody });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({
          user: {
            name: 'Bob',
            address: { street: '123 Main St', city: 'NYC' },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe('Bob');
      expect(response.body.data.user.address.city).toBe('NYC');
    });

    it('should work with array schemas', async () => {
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            quantity: z.number().positive(),
          })
        ),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.validatedBody });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({
          items: [
            { id: 'item-1', quantity: 5 },
            { id: 'item-2', quantity: 10 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.items[0].quantity).toBe(5);
    });

    it('should handle empty body when schema expects data', async () => {
      const schema = z.object({
        required: z.string(),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app).post('/test').send({});

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should report multiple validation errors together', async () => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
        age: z.number().int().min(18),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({ name: 'ab', email: 'invalid', age: 10 }); // All fields invalid

      expect(response.status).toBe(400);
      const devMessage = response.body.error?.developerMessage;
      expect(devMessage).toContain('name');
      expect(devMessage).toContain('email');
      expect(devMessage).toContain('age');
    });
  });

  describe('validateRequestQueryWithZod - Query Parameter Validation', () => {
    it('should validate valid query parameters and set validatedQuery', async () => {
      const schema = z.object({
        page: z.string().transform(Number).pipe(z.number().int().positive()),
        limit: z.string().transform(Number).pipe(z.number().int().positive()),
      });

      let capturedValidatedQuery: any;

      app.get('/test', validateRequestQueryWithZod(schema), (req: Request, res: Response) => {
        capturedValidatedQuery = req.validatedQuery;
        res.json({ success: true, data: req.validatedQuery });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(capturedValidatedQuery).toEqual({ page: 1, limit: 10 });
    });

    it('should return 400 for invalid query parameters', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      app.get('/test', validateRequestQueryWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test?id=invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.error?.userFacingMessage).toBe('Invalid UUID');
    });

    it('should handle missing required query parameters', async () => {
      const schema = z.object({
        required: z.string(),
      });

      app.get('/test', validateRequestQueryWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should work with optional query parameters', async () => {
      const schema = z.object({
        search: z.string().optional(),
        filter: z.string().optional(),
      });

      app.get('/test', validateRequestQueryWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.validatedQuery });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test?search=test');

      expect(response.status).toBe(200);
      expect(response.body.data.search).toBe('test');
      expect(response.body.data.filter).toBeUndefined();
    });
  });

  describe('validateRequestParamsWithZod - Path Parameter Validation', () => {
    it('should validate valid path parameters and set validatedParams', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      let capturedValidatedParams: any;

      app.get(
        '/test/:id',
        validateRequestParamsWithZod(schema),
        (req: Request, res: Response) => {
          capturedValidatedParams = req.validatedParams;
          res.json({ success: true, data: req.validatedParams });
        }
      );
      app.use(standardErrorHandler);

      const testUuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app).get(`/test/${testUuid}`);

      expect(response.status).toBe(200);
      expect(capturedValidatedParams).toEqual({ id: testUuid });
    });

    it('should return 400 for invalid path parameters', async () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      app.get(
        '/test/:id',
        validateRequestParamsWithZod(schema),
        (req: Request, res: Response) => {
          res.json({ success: true });
        }
      );
      app.use(standardErrorHandler);

      const response = await request(app).get('/test/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.error?.userFacingMessage).toBe('Invalid UUID');
    });

    it('should work with multiple path parameters', async () => {
      const schema = z.object({
        tenantId: z.string().uuid(),
        productId: z.string().uuid(),
      });

      app.get(
        '/test/:tenantId/:productId',
        validateRequestParamsWithZod(schema),
        (req: Request, res: Response) => {
          res.json({ success: true, data: req.validatedParams });
        }
      );
      app.use(standardErrorHandler);

      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const productId = '660e8400-e29b-41d4-a716-446655440001';
      const response = await request(app).get(`/test/${tenantId}/${productId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tenantId).toBe(tenantId);
      expect(response.body.data.productId).toBe(productId);
    });

    it('should work with custom validation rules', async () => {
      const schema = z.object({
        slug: z.string().regex(/^[a-z0-9-]+$/),
      });

      app.get('/test/:slug', validateRequestParamsWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.validatedParams });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test/my-valid-slug');

      expect(response.status).toBe(200);
      expect(response.body.data.slug).toBe('my-valid-slug');
    });

    it('should reject invalid custom validation rules', async () => {
      const schema = z.object({
        slug: z.string().regex(/^[a-z0-9-]+$/),
      });

      app.get('/test/:slug', validateRequestParamsWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app).get('/test/Invalid_Slug!');

      expect(response.status).toBe(400);
      expect(response.body.error?.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('Integration with Error Handler', () => {
    it('should integrate with standard error handler', async () => {
      const schema = z.object({
        name: z.string().min(1),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app).post('/test').send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(response.body.error?.correlationId).toBeDefined();
    });

    it('should include correlationId in validation errors', async () => {
      const schema = z.object({
        email: z.string().email(),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true });
      });
      app.use(standardErrorHandler);

      const response = await request(app).post('/test').send({ email: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error?.correlationId).toBeDefined();
      expect(typeof response.body.error?.correlationId).toBe('string');
    });
  });

  describe('Complex Schema Validation', () => {
    it('should validate complex nested schema with transformations', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.string().transform(Number).pipe(z.number().int().min(18)),
        }),
        tags: z.array(z.string()).min(1),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.validatedBody });
      });
      app.use(standardErrorHandler);

      const response = await request(app)
        .post('/test')
        .send({
          user: { name: 'John', age: '25' },
          tags: ['tag1', 'tag2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.age).toBe(25); // Transformed to number
    });

    it('should handle union types in schemas', async () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      app.post('/test', validateRequestBodyWithZod(schema), (req: Request, res: Response) => {
        res.json({ success: true, data: req.validatedBody });
      });
      app.use(standardErrorHandler);

      const response1 = await request(app).post('/test').send({ value: 'string' });
      expect(response1.status).toBe(200);
      expect(response1.body.data.value).toBe('string');

      const response2 = await request(app).post('/test').send({ value: 123 });
      expect(response2.status).toBe(200);
      expect(response2.body.data.value).toBe(123);
    });
  });
});
