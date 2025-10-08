// [ST-002][AC-002] Health endpoint acceptance tests
import request from 'supertest';
import type { Express } from 'express';
import { createConfiguredExpressApplicationInstance } from '../src/app.js';

describe('[ST-002] Health Check', () => {
  let app: Express;

  beforeAll(() => {
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;
  });

  describe('[AC-002] GET /api/health', () => {
    it('should return 200 status code', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
    });

    it('should return success envelope with ok boolean', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('healthStatus', 'HEALTHY');
    });

    it('should return valid JSON content-type', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('[AC-002-2] GET /api/version', () => {
    it('should return version information', async () => {
      const response = await request(app).get('/api/version');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('semanticVersion');
    });
  });
});
