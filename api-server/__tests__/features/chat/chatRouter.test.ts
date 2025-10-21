// api-server/__tests__/routes/chatRouter.test.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import type { Express } from 'express';
import request from 'supertest';
import { createConfiguredExpressApplicationInstance } from '../../../src/app.js';
import { createTestTenant, createTestUser } from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { createConversation } from '../../../src/services/chat/conversationService.js';

describe('Chat Router - Conversation Endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;
  });

  describe('GET /api/chat/conversations', () => {
    it('should list conversations for authenticated user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      // Create test conversations
      await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Test 1' },
      });

      await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Test 2' },
      });

      const response = await request(app)
        .get('/api/chat/conversations')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/chat/conversations');

      expect(response.status).toBe(401);
    });

    it('should only show user\'s own conversations', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Create conversation for user1
      await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      // Create conversation for user2
      await createConversation({
        userId: user2.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 2 conversation' },
      });

      // User 1 should only see their own conversations
      const sessionCookie = createSessionCookie(user1.id, tenant.id);
      const response = await request(app)
        .get('/api/chat/conversations')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.every((c: any) => c.userId === user1.id)).toBe(true);
    });

    it('should respect limit query parameter', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await createConversation({
          userId: user.id,
          tenantId: tenant.id,
          firstMessage: { role: 'user', content: `Test ${i}` },
        });
      }

      const response = await request(app)
        .get('/api/chat/conversations?limit=3')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('GET /api/chat/conversations/:conversationId', () => {
    it('should retrieve conversation with messages', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Test message' },
      });

      const response = await request(app)
        .get(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(conversation.id);
      expect(response.body.data.messages).toHaveLength(1);
      expect(response.body.data.messages[0].content).toBe('Test message');
    });

    it('should return 404 for non-existent conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const response = await request(app)
        .get('/api/chat/conversations/nonexistent-id')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.errorCode).toBe('NOT_FOUND');
    });

    it('should return 404 when accessing another user\'s conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Create conversation for user1
      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Private conversation' },
      });

      // User2 tries to access user1's conversation
      const sessionCookie = createSessionCookie(user2.id, tenant.id);
      const response = await request(app)
        .get(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error.errorCode).toBe('NOT_FOUND');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/chat/conversations/some-id');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/chat/conversations/:conversationId', () => {
    it('should delete conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'To be deleted' },
      });

      const response = await request(app)
        .delete(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify conversation is deleted
      const getResponse = await request(app)
        .get(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie);

      expect(getResponse.status).toBe(404);
    });

    it('should not delete another user\'s conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Create conversation for user1
      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      // User2 tries to delete user1's conversation
      const sessionCookie = createSessionCookie(user2.id, tenant.id);
      const response = await request(app)
        .delete(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(500); // Throws error
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/chat/conversations/some-id');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/chat/conversations/:conversationId', () => {
    it('should update conversation title', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Original title' },
      });

      const response = await request(app)
        .patch(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie)
        .send({ title: 'Updated title' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated title');

      // Verify update persisted
      const getResponse = await request(app)
        .get(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie);

      expect(getResponse.body.data.title).toBe('Updated title');
    });

    it('should validate title is present', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Test' },
      });

      const response = await request(app)
        .patch(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should validate title is a string', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Test' },
      });

      const response = await request(app)
        .patch(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie)
        .send({ title: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should not update another user\'s conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Create conversation for user1
      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      // User2 tries to update user1's conversation
      const sessionCookie = createSessionCookie(user2.id, tenant.id);
      const response = await request(app)
        .patch(`/api/chat/conversations/${conversation.id}`)
        .set('Cookie', sessionCookie)
        .send({ title: 'Unauthorized update' });

      expect(response.status).toBe(500); // Throws error
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/chat/conversations/some-id')
        .send({ title: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/chat - with conversationId', () => {
    it('should validate messages array', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const response = await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          messages: 'not an array',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Test' }],
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/chat/analytics', () => {
    it('should return analytics summary for authenticated user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const response = await request(app)
        .get('/api/chat/analytics')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalConversations');
      expect(response.body.data).toHaveProperty('totalMessages');
      expect(response.body.data).toHaveProperty('uniqueUsers');
      expect(response.body.data).toHaveProperty('topTools');
      expect(response.body.data).toHaveProperty('dailyData');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/chat/analytics');

      expect(response.status).toBe(401);
    });

    it('should accept startDate and endDate query parameters', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const sessionCookie = createSessionCookie(user.id, tenant.id);

      const response = await request(app)
        .get('/api/chat/analytics?startDate=2025-01-01&endDate=2025-01-31')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
