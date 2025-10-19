// api-server/src/services/chat/analyticsService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';

/**
 * Chat analytics service for tracking chatbot usage
 *
 * Tracks daily metrics aggregated by tenant:
 * - Total conversations started
 * - Total messages sent
 * - Unique users
 * - Tool usage counts
 * - Average metrics (messages per conversation, response time)
 */

/**
 * Record a new conversation started
 */
export async function recordConversationStarted({
  tenantId,
  userId,
  date,
}: {
  tenantId: string;
  userId: string;
  date: Date;
}): Promise<void> {
  const dateOnly = new Date(date.toISOString().split('T')[0]!);

  // Upsert analytics record for the day
  await prismaClientInstance.chatAnalytics.upsert({
    where: {
      tenantId_date: {
        tenantId,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      date: dateOnly,
      totalConversations: 1,
      totalMessages: 0,
      uniqueUsers: 1,
    },
    update: {
      totalConversations: { increment: 1 },
      // Note: uniqueUsers will be updated separately via aggregation
    },
  });
}

/**
 * Record messages sent (user + assistant)
 */
export async function recordMessages({
  tenantId,
  date,
  count,
}: {
  tenantId: string;
  date: Date;
  count: number;
}): Promise<void> {
  const dateOnly = new Date(date.toISOString().split('T')[0]!);

  await prismaClientInstance.chatAnalytics.upsert({
    where: {
      tenantId_date: {
        tenantId,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      date: dateOnly,
      totalConversations: 0,
      totalMessages: count,
      uniqueUsers: 0,
    },
    update: {
      totalMessages: { increment: count },
    },
  });
}

/**
 * Record tool usage
 */
export async function recordToolUsage({
  tenantId,
  date,
  toolName,
}: {
  tenantId: string;
  date: Date;
  toolName: string;
}): Promise<void> {
  const dateOnly = new Date(date.toISOString().split('T')[0]!);

  // Get current analytics record
  const analytics = await prismaClientInstance.chatAnalytics.findUnique({
    where: {
      tenantId_date: {
        tenantId,
        date: dateOnly,
      },
    },
  });

  // Build updated tool calls object
  const currentToolCalls = (analytics?.toolCalls as Record<string, number>) || {};
  const updatedToolCalls = {
    ...currentToolCalls,
    [toolName]: (currentToolCalls[toolName] || 0) + 1,
  };

  // Upsert with updated tool calls
  await prismaClientInstance.chatAnalytics.upsert({
    where: {
      tenantId_date: {
        tenantId,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      date: dateOnly,
      totalConversations: 0,
      totalMessages: 0,
      uniqueUsers: 0,
      toolCalls: updatedToolCalls,
    },
    update: {
      toolCalls: updatedToolCalls,
    },
  });
}

/**
 * Update unique users count for a date
 * Should be run as a batch job or periodically
 */
export async function updateUniqueUsersCount({
  tenantId,
  date,
}: {
  tenantId: string;
  date: Date;
}): Promise<void> {
  const dateOnly = new Date(date.toISOString().split('T')[0]!);
  const nextDay = new Date(dateOnly);
  nextDay.setDate(nextDay.getDate() + 1);

  // Count unique users who created conversations on this date
  const uniqueUsersCount = await prismaClientInstance.chatConversation.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: dateOnly,
        lt: nextDay,
      },
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });

  // Update analytics with unique user count
  await prismaClientInstance.chatAnalytics.upsert({
    where: {
      tenantId_date: {
        tenantId,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      date: dateOnly,
      totalConversations: 0,
      totalMessages: 0,
      uniqueUsers: uniqueUsersCount.length,
    },
    update: {
      uniqueUsers: uniqueUsersCount.length,
    },
  });
}

/**
 * Calculate and update average metrics for a date
 */
export async function updateAverageMetrics({
  tenantId,
  date,
}: {
  tenantId: string;
  date: Date;
}): Promise<void> {
  const dateOnly = new Date(date.toISOString().split('T')[0]!);
  const nextDay = new Date(dateOnly);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get all conversations created on this date
  const conversations = await prismaClientInstance.chatConversation.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: dateOnly,
        lt: nextDay,
      },
    },
    include: {
      messages: true,
    },
  });

  if (conversations.length === 0) return;

  // Calculate average messages per conversation
  const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
  const avgMessagesPerConversation = totalMessages / conversations.length;

  // Upsert analytics with average
  await prismaClientInstance.chatAnalytics.upsert({
    where: {
      tenantId_date: {
        tenantId,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      date: dateOnly,
      totalConversations: 0,
      totalMessages: 0,
      uniqueUsers: 0,
      avgMessagesPerConversation,
    },
    update: {
      avgMessagesPerConversation,
    },
  });
}

/**
 * Get analytics for a date range
 */
export async function getAnalytics({
  tenantId,
  startDate,
  endDate,
}: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const analytics = await prismaClientInstance.chatAnalytics.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  return analytics;
}

/**
 * Get analytics summary (totals across date range)
 */
export async function getAnalyticsSummary({
  tenantId,
  startDate,
  endDate,
}: {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}) {
  const analytics = await getAnalytics({ tenantId, startDate, endDate });

  // Aggregate tool calls across all days
  const toolCallsSummary: Record<string, number> = {};
  let totalToolCalls = 0;

  for (const day of analytics) {
    if (day.toolCalls) {
      const dayToolCalls = day.toolCalls as Record<string, number>;
      for (const [tool, count] of Object.entries(dayToolCalls)) {
        toolCallsSummary[tool] = (toolCallsSummary[tool] || 0) + count;
        totalToolCalls += count;
      }
    }
  }

  // Get top 5 most used tools
  const topTools = Object.entries(toolCallsSummary)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalConversations: analytics.reduce((sum, a) => sum + a.totalConversations, 0),
    totalMessages: analytics.reduce((sum, a) => sum + a.totalMessages, 0),
    uniqueUsers: Math.max(...analytics.map(a => a.uniqueUsers), 0), // Peak daily users
    averageMessagesPerConversation:
      analytics.reduce((sum, a) => sum + (a.avgMessagesPerConversation || 0), 0) / analytics.length,
    toolCallsSummary,
    topTools,
    totalToolCalls,
    dailyData: analytics,
  };
}
