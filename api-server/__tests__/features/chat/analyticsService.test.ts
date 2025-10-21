// api-server/__tests__/services/chat/analyticsService.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  recordConversationStarted,
  recordMessages,
  recordToolUsage,
  updateUniqueUsersCount,
  updateAverageMetrics,
  getAnalytics,
  getAnalyticsSummary,
} from '../../../src/services/chat/analyticsService.js';
import { createTestTenant, createTestUser } from '../../helpers/factories.js';
import { prismaClientInstance } from '../../../src/db/prismaClient.js';
import { createConversation, addMessageToConversation } from '../../../src/services/chat/conversationService.js';

describe('Analytics Service', () => {
  describe('recordConversationStarted', () => {
    it('should create analytics record for new date', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const date = new Date('2025-01-15');

      await recordConversationStarted({
        tenantId: tenant.id,
        userId: user.id,
        date,
      });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      expect(analytics).toBeDefined();
      expect(analytics!.totalConversations).toBe(1);
      expect(analytics!.totalMessages).toBe(0);
    });

    it('should increment conversations on existing date', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const date = new Date('2025-01-15');

      // Record first conversation
      await recordConversationStarted({ tenantId: tenant.id, userId: user.id, date });

      // Record second conversation
      await recordConversationStarted({ tenantId: tenant.id, userId: user.id, date });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      expect(analytics!.totalConversations).toBe(2);
    });
  });

  describe('recordMessages', () => {
    it('should create analytics record with message count', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const date = new Date('2025-01-15');

      await recordMessages({
        tenantId: tenant.id,
        date,
        count: 2,
      });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      expect(analytics!.totalMessages).toBe(2);
    });

    it('should increment messages on existing date', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const date = new Date('2025-01-15');

      await recordMessages({ tenantId: tenant.id, date, count: 2 });
      await recordMessages({ tenantId: tenant.id, date, count: 3 });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      expect(analytics!.totalMessages).toBe(5);
    });
  });

  describe('recordToolUsage', () => {
    it('should create analytics with tool usage', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const date = new Date('2025-01-15');

      await recordToolUsage({
        tenantId: tenant.id,
        date,
        toolName: 'searchProducts',
      });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      const toolCalls = analytics!.toolCalls as Record<string, number>;
      expect(toolCalls.searchProducts).toBe(1);
    });

    it('should increment tool usage counts', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const date = new Date('2025-01-15');

      await recordToolUsage({ tenantId: tenant.id, date, toolName: 'searchProducts' });
      await recordToolUsage({ tenantId: tenant.id, date, toolName: 'searchProducts' });
      await recordToolUsage({ tenantId: tenant.id, date, toolName: 'searchTransfers' });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      const toolCalls = analytics!.toolCalls as Record<string, number>;
      expect(toolCalls.searchProducts).toBe(2);
      expect(toolCalls.searchTransfers).toBe(1);
    });

    it('should track multiple different tools', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const date = new Date('2025-01-15');

      const tools = ['searchProducts', 'searchTransfers', 'getBranchInfo', 'searchUsers'];
      for (const tool of tools) {
        await recordToolUsage({ tenantId: tenant.id, date, toolName: tool });
      }

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      const toolCalls = analytics!.toolCalls as Record<string, number>;
      expect(Object.keys(toolCalls)).toHaveLength(4);
      expect(toolCalls.searchProducts).toBe(1);
      expect(toolCalls.searchTransfers).toBe(1);
      expect(toolCalls.getBranchInfo).toBe(1);
      expect(toolCalls.searchUsers).toBe(1);
    });
  });

  describe('updateUniqueUsersCount', () => {
    it('should count unique users who created conversations', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const user3 = await createTestUser();
      const date = new Date('2025-01-15');

      // Create conversations for different users on same date
      const conversations = [
        await createConversation({
          userId: user1.id,
          tenantId: tenant.id,
          firstMessage: { role: 'user', content: 'Test 1' },
        }),
        await createConversation({
          userId: user2.id,
          tenantId: tenant.id,
          firstMessage: { role: 'user', content: 'Test 2' },
        }),
        await createConversation({
          userId: user3.id,
          tenantId: tenant.id,
          firstMessage: { role: 'user', content: 'Test 3' },
        }),
        // User 1 creates another conversation (shouldn't increase unique count)
        await createConversation({
          userId: user1.id,
          tenantId: tenant.id,
          firstMessage: { role: 'user', content: 'Test 4' },
        }),
      ];

      // Update all conversations to have the test date
      for (const conv of conversations) {
        await prismaClientInstance.chatConversation.update({
          where: { id: conv.id },
          data: { createdAt: date },
        });
      }

      await updateUniqueUsersCount({
        tenantId: tenant.id,
        date,
      });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      expect(analytics!.uniqueUsers).toBe(3); // 3 unique users, not 4 conversations
    });
  });

  describe('updateAverageMetrics', () => {
    it('should calculate average messages per conversation', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();
      const date = new Date('2025-01-15');

      // Create conversations with different message counts
      const conv1 = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Conv 1' },
      });

      const conv2 = await createConversation({
        userId: user.id,
        tenantId: tenant.id,
        firstMessage: { role: 'user', content: 'Conv 2' },
      });

      // Add more messages to conv2
      await addMessageToConversation({
        conversationId: conv2.id,
        userId: user.id,
        tenantId: tenant.id,
        message: { role: 'assistant', content: 'Response' },
      });

      await addMessageToConversation({
        conversationId: conv2.id,
        userId: user.id,
        tenantId: tenant.id,
        message: { role: 'user', content: 'Follow up' },
      });

      // Update conversations to test date
      await prismaClientInstance.chatConversation.updateMany({
        where: { id: { in: [conv1.id, conv2.id] } },
        data: { createdAt: date },
      });

      await updateAverageMetrics({
        tenantId: tenant.id,
        date,
      });

      const analytics = await prismaClientInstance.chatAnalytics.findUnique({
        where: {
          tenantId_date: {
            tenantId: tenant.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      // Conv1: 1 message, Conv2: 3 messages, Average: 2
      expect(analytics!.avgMessagesPerConversation).toBe(2);
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve analytics for date range', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      // Create analytics for multiple days
      const dates = [
        new Date('2025-01-15'),
        new Date('2025-01-16'),
        new Date('2025-01-17'),
      ];

      for (const date of dates) {
        await recordConversationStarted({ tenantId: tenant.id, userId: user.id, date });
        await recordMessages({ tenantId: tenant.id, date, count: 5 });
      }

      const analytics = await getAnalytics({
        tenantId: tenant.id,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-17'),
      });

      expect(analytics).toHaveLength(3);
      expect(analytics[0]?.totalConversations).toBe(1);
      expect(analytics[0]?.totalMessages).toBe(5);
    });

    it('should return empty array for date range with no data', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });

      const analytics = await getAnalytics({
        tenantId: tenant.id,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-17'),
      });

      expect(analytics).toHaveLength(0);
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should aggregate analytics across date range', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      const dates = [new Date('2025-01-15'), new Date('2025-01-16')];

      for (const date of dates) {
        await recordConversationStarted({ tenantId: tenant.id, userId: user.id, date });
        await recordMessages({ tenantId: tenant.id, date, count: 10 });
        await recordToolUsage({ tenantId: tenant.id, date, toolName: 'searchProducts' });
        await recordToolUsage({ tenantId: tenant.id, date, toolName: 'searchTransfers' });
      }

      const summary = await getAnalyticsSummary({
        tenantId: tenant.id,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-16'),
      });

      expect(summary.totalConversations).toBe(2);
      expect(summary.totalMessages).toBe(20);
      expect(summary.totalToolCalls).toBe(4);
      expect(summary.toolCallsSummary.searchProducts).toBe(2);
      expect(summary.toolCallsSummary.searchTransfers).toBe(2);
    });

    it('should return top 5 most used tools', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const date = new Date('2025-01-15');

      // Create varied tool usage
      const toolUsage = {
        searchProducts: 10,
        searchTransfers: 8,
        getBranchInfo: 6,
        searchUsers: 4,
        getProductStock: 2,
        listBranches: 1,
      };

      for (const [tool, count] of Object.entries(toolUsage)) {
        for (let i = 0; i < count; i++) {
          await recordToolUsage({ tenantId: tenant.id, date, toolName: tool });
        }
      }

      const summary = await getAnalyticsSummary({
        tenantId: tenant.id,
        startDate: date,
        endDate: date,
      });

      expect(summary.topTools).toHaveLength(5);
      expect(summary.topTools[0]?.name).toBe('searchProducts');
      expect(summary.topTools[0]?.count).toBe(10);
      expect(summary.topTools[4]?.name).toBe('getProductStock');
      expect(summary.topTools[4]?.count).toBe(2);
    });

    it('should handle empty analytics', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });

      const summary = await getAnalyticsSummary({
        tenantId: tenant.id,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-01-17'),
      });

      expect(summary.totalConversations).toBe(0);
      expect(summary.totalMessages).toBe(0);
      expect(summary.topTools).toHaveLength(0);
    });
  });
});
