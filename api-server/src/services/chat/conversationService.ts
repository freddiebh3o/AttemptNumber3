// api-server/src/services/chat/conversationService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import type { ChatConversation, ChatMessage } from '@prisma/client';

/**
 * Conversation persistence service for AI chatbot
 *
 * SECURITY:
 * - All queries filtered by userId + tenantId (multi-tenant isolation)
 * - Users can only access their own conversations
 * - CASCADE deletes ensure cleanup when conversation/user deleted
 */

export type ConversationWithMessages = ChatConversation & {
  messages: ChatMessage[];
};

/**
 * Create a new conversation
 * Title is generated from first user message (first 50 chars)
 */
export async function createConversation({
  userId,
  tenantId,
  firstMessage,
}: {
  userId: string;
  tenantId: string;
  firstMessage: {
    role: string;
    content: any; // UIMessage content (can be string or parts array)
  };
}): Promise<ConversationWithMessages> {
  // Generate title from first message
  let title = 'New Conversation';

  // Extract text for title generation
  if (typeof firstMessage.content === 'string') {
    title = firstMessage.content.substring(0, 50);
  } else if (Array.isArray(firstMessage.content)) {
    // Handle parts array from AI SDK v5
    const textPart = firstMessage.content.find((p: any) => p.type === 'text');
    if (textPart?.text) {
      title = textPart.text.substring(0, 50);
    }
  }

  // Ensure content is not undefined
  if (!firstMessage.content) {
    throw new Error('Message content is required');
  }

  // Create conversation with first message
  const conversation = await prismaClientInstance.chatConversation.create({
    data: {
      userId,
      tenantId,
      title,
      messages: {
        create: {
          role: firstMessage.role,
          content: firstMessage.content,
        },
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return conversation;
}

/**
 * Get conversation by ID
 * SECURITY: Only returns if user owns conversation AND same tenant
 */
export async function getConversation({
  conversationId,
  userId,
  tenantId,
}: {
  conversationId: string;
  userId: string;
  tenantId: string;
}): Promise<ConversationWithMessages | null> {
  const conversation = await prismaClientInstance.chatConversation.findFirst({
    where: {
      id: conversationId,
      userId,
      tenantId,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return conversation;
}

/**
 * List all conversations for a user in a tenant
 * Sorted by most recent first
 */
export async function listConversations({
  userId,
  tenantId,
  limit = 50,
}: {
  userId: string;
  tenantId: string;
  limit?: number;
}): Promise<ChatConversation[]> {
  const conversations = await prismaClientInstance.chatConversation.findMany({
    where: {
      userId,
      tenantId,
    },
    orderBy: {
      updatedAt: 'desc', // Most recent first
    },
    take: limit,
    // Don't include messages for list view (performance)
  });

  return conversations;
}

/**
 * Add message to existing conversation
 */
export async function addMessageToConversation({
  conversationId,
  userId,
  tenantId,
  message,
}: {
  conversationId: string;
  userId: string;
  tenantId: string;
  message: {
    role: string;
    content: any; // UIMessage content
  };
}): Promise<ChatMessage> {
  // Verify user owns conversation
  const conversation = await getConversation({ conversationId, userId, tenantId });
  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Create message and update conversation updatedAt
  const chatMessage = await prismaClientInstance.chatMessage.create({
    data: {
      conversationId,
      role: message.role,
      content: message.content,
    },
  });

  // Update conversation updatedAt (for sorting)
  await prismaClientInstance.chatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return chatMessage;
}

/**
 * Delete conversation
 * SECURITY: Only delete if user owns conversation
 */
export async function deleteConversation({
  conversationId,
  userId,
  tenantId,
}: {
  conversationId: string;
  userId: string;
  tenantId: string;
}): Promise<void> {
  // Verify user owns conversation
  const conversation = await getConversation({ conversationId, userId, tenantId });
  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Delete conversation (CASCADE will delete messages)
  await prismaClientInstance.chatConversation.delete({
    where: { id: conversationId },
  });
}

/**
 * Update conversation title
 */
export async function updateConversationTitle({
  conversationId,
  userId,
  tenantId,
  title,
}: {
  conversationId: string;
  userId: string;
  tenantId: string;
  title: string;
}): Promise<ChatConversation> {
  // Verify user owns conversation
  const conversation = await getConversation({ conversationId, userId, tenantId });
  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  const updated = await prismaClientInstance.chatConversation.update({
    where: { id: conversationId },
    data: { title },
  });

  return updated;
}
