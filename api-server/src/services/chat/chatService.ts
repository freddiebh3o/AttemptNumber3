// api-server/src/services/chat/chatService.ts
import { streamText, convertToModelMessages, stepCountIs, pipeUIMessageStreamToResponse } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Response } from 'express';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { getPermissionKeysForUserInTenant } from '../permissionService.js';
import { transferTools } from './tools/transferTools.js';
import { buildSystemMessage } from './promptBuilder.js';

/**
 * Stream chat response to client
 *
 * SECURITY:
 * - Gets user's actual permissions from database
 * - Gets user's branch memberships
 * - Tools use existing service functions that enforce security
 * - All data automatically filtered by tenant and branch membership
 */
export async function streamChatResponse({
  messages,
  userId,
  tenantId,
  res,
}: {
  messages: any[]; // UIMessage[] from frontend
  userId: string;
  tenantId: string;
  res: Response;
}) {
  // Get user info
  const user = await prismaClientInstance.user.findUnique({
    where: { id: userId },
    select: { id: true, userEmailAddress: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get user's tenant membership with role
  const membership = await prismaClientInstance.userTenantMembership.findFirst({
    where: { userId, tenantId },
    select: {
      id: true,
      roleId: true,
      role: {
        select: { name: true },
      },
    },
  });

  // Get user's actual permissions using permissionService
  const permissionKeys = await getPermissionKeysForUserInTenant({ userId, tenantId });
  const permissionsArray = Array.from(permissionKeys);

  // Get user's branch memberships for context
  const branchMemberships = await prismaClientInstance.userBranchMembership.findMany({
    where: { userId, tenantId },
    include: { branch: { select: { branchName: true, id: true } } },
  });

  // Build system message with full context
  const systemMessage = buildSystemMessage({
    userName: user.userEmailAddress || 'User',
    ...(membership?.role.name ? { userRole: membership.role.name } : {}),
    permissions: permissionsArray,
    branchMemberships: branchMemberships.map(m => ({
      branchId: m.branchId,
      branchName: m.branch.branchName,
    })),
    tenantId,
  });

  // Convert messages to model format (removes UI-specific fields)
  const modelMessages = convertToModelMessages(messages);

  // Stream response from OpenAI
  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemMessage,
    messages: modelMessages,
    tools: transferTools({ userId, tenantId }),
    temperature: 0.7,
    // v5: Use stopWhen instead of maxSteps for multi-step control
    stopWhen: stepCountIs(10),
  });

  // Convert to UI Message Stream and pipe to response (for React useChat hook)
  const uiMessageStream = result.toUIMessageStream();
  pipeUIMessageStreamToResponse({
    response: res,
    stream: uiMessageStream,
  });
}
