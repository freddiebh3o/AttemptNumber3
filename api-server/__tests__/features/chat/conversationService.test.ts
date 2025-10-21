// api-server/__tests__/services/chat/conversationService.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  createConversation,
  getConversation,
  listConversations,
  addMessageToConversation,
  deleteConversation,
  updateConversationTitle,
} from '../../../src/services/chat/conversationService.js';
import { createTestTenant, createTestUser } from '../../helpers/factories.js';

describe('Conversation Service', () => {

  describe('createConversation', () => {
    it('should create conversation with first message', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: {
          role: 'user',
          content: 'Hello, what is a stock transfer?',
        },
      });

      expect(conversation.id).toBeDefined();
      expect(conversation.userId).toBe(user.id);
      expect(conversation.tenantId).toBe(tenant.id);
      expect(conversation.title).toBe('Hello, what is a stock transfer?');
      expect(conversation.messages).toHaveLength(1);
      expect(conversation.messages[0].role).toBe('user');
      expect(conversation.messages[0].content).toBe('Hello, what is a stock transfer?');
    });

    it('should generate title from parts array content', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: {
          role: 'user',
          content: [
            { type: 'text', text: 'How do I create a transfer?' },
          ],
        },
      });

      expect(conversation.title).toBe('How do I create a transfer?');
    });

    it('should truncate long titles to 50 chars', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const longMessage = 'This is a very long message that should be truncated to exactly fifty characters when used as title';

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: {
          role: 'user',
          content: longMessage,
        },
      });

      expect(conversation.title).toHaveLength(50);
      expect(conversation.title).toBe(longMessage.substring(0, 50));
    });
  });

  describe('getConversation', () => {
    it('should retrieve conversation with messages', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const created = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: {
          role: 'user',
          content: 'Test message',
        },
      });

      const retrieved = await getConversation({
        conversationId: created.id,
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.messages).toHaveLength(1);
    });

    it('should not return conversation from different user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: {
          role: 'user',
          content: 'Private conversation',
        },
      });

      // User 2 tries to access User 1's conversation
      const retrieved = await getConversation({
        conversationId: conversation.id,
        userId: user2.id, // Different user!
        tenantId: tenant.id,
      });

      expect(retrieved).toBeNull();
    });

    it('should not return conversation from different tenant', async () => {
      const tenant1 = await createTestTenant({ name: 'Tenant 1' });
      const tenant2 = await createTestTenant({ name: 'Tenant 2' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant1.id,
        firstMessage: {
          role: 'user',
          content: 'Tenant 1 conversation',
        },
      });

      // Try to access from different tenant
      const retrieved = await getConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant2.id, // Different tenant!
      });

      expect(retrieved).toBeNull();
    });
  });

  describe('listConversations', () => {
    it('should list conversations for user in tenant', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      // Create multiple conversations
      await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Conversation 1' },
      });

      await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Conversation 2' },
      });

      await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Conversation 3' },
      });

      const conversations = await listConversations({
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(conversations.length).toBeGreaterThanOrEqual(3);
      // Should be sorted by updatedAt desc (most recent first)
      expect(new Date(conversations[0].updatedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(conversations[1].updatedAt).getTime());
    });

    it('should only return conversations for specific user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      await createConversation({
        userId: user2.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 2 conversation' },
      });

      const user1Conversations = await listConversations({
        userId: user1.id,
        tenantId: tenant.id,
      });

      // User 1 should only see their own conversations
      const user1ConversationIds = user1Conversations.map(c => c.id);
      for (const conv of user1Conversations) {
        expect(conv.userId).toBe(user1.id);
      }
    });

    it('should respect limit parameter', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await createConversation({
          userId: user.id,
          tenantId: tenant.id,
          firstMessage: { role: 'user', content: `Conversation ${i}` },
        });
      }

      const conversations = await listConversations({
        userId: user.id,
        tenantId: tenant.id,
        limit: 3,
      });

      expect(conversations).toHaveLength(3);
    });
  });

  describe('addMessageToConversation', () => {
    it('should add message to existing conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'First message' },
      });

      const message = await addMessageToConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
        message: {
          role: 'assistant',
          content: 'Assistant response',
        },
      });

      expect(message.id).toBeDefined();
      expect(message.conversationId).toBe(conversation.id);
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Assistant response');

      // Verify conversation now has 2 messages
      const updated = await getConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(updated!.messages).toHaveLength(2);
      expect(updated!.messages[1].role).toBe('assistant');
    });

    it('should not add message to conversation from different user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      // User 2 tries to add message to User 1's conversation
      await expect(
        addMessageToConversation({
          conversationId: conversation.id,
          userId: user2.id, // Different user!
          tenantId: tenant.id,
          message: {
            role: 'user',
            content: 'Unauthorized message',
          },
        })
      ).rejects.toThrow('Conversation not found or access denied');
    });

    it('should update conversation updatedAt timestamp', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'First message' },
      });

      const originalUpdatedAt = conversation.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      await addMessageToConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
        message: { role: 'assistant', content: 'Response' },
      });

      const updated = await getConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(new Date(updated!.updatedAt).getTime())
        .toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation and cascade delete messages', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Test conversation' },
      });

      await addMessageToConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
        message: { role: 'assistant', content: 'Response' },
      });

      await deleteConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
      });

      // Verify conversation is deleted
      const retrieved = await getConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(retrieved).toBeNull();
    });

    it('should not delete conversation from different user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      // User 2 tries to delete User 1's conversation
      await expect(
        deleteConversation({
          conversationId: conversation.id,
          userId: user2.id, // Different user!
          tenantId: tenant.id,
        })
      ).rejects.toThrow('Conversation not found or access denied');

      // Verify conversation still exists
      const stillExists = await getConversation({
        conversationId: conversation.id,
        userId: user1.id,
        tenantId: tenant.id,
      });

      expect(stillExists).not.toBeNull();
    });
  });

  describe('updateConversationTitle', () => {
    it('should update conversation title', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const conversation = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Original title' },
      });

      const updated = await updateConversationTitle({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
        title: 'New custom title',
      });

      expect(updated.title).toBe('New custom title');

      // Verify update persisted
      const retrieved = await getConversation({
        conversationId: conversation.id,
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(retrieved!.title).toBe('New custom title');
    });

    it('should not update title for conversation from different user', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const conversation = await createConversation({
        userId: user1.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'User 1 conversation' },
      });

      // User 2 tries to update User 1's conversation title
      await expect(
        updateConversationTitle({
          conversationId: conversation.id,
          userId: user2.id, // Different user!
          tenantId: tenant.id,
          title: 'Unauthorized update',
        })
      ).rejects.toThrow('Conversation not found or access denied');
    });
  });
});
