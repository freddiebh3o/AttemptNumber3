// api-server/src/services/chat/chatService.ts
import { streamText, convertToModelMessages, stepCountIs, pipeUIMessageStreamToResponse } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Response } from 'express';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { getPermissionKeysForUserInTenant } from '../permissionService.js';
import { transferTools } from './tools/transferTools.js';
import { productTools } from './tools/productTools.js';
import { stockTools } from './tools/stockTools.js';
import { branchTools } from './tools/branchTools.js';
import { userTools } from './tools/userTools.js';
import { templateTools } from './tools/templateTools.js';
import { approvalTools } from './tools/approvalTools.js';
import { analyticsTools } from './tools/analyticsTools.js';
import { buildSystemMessage } from './promptBuilder.js';
import { searchDocumentation } from './ragService.js';

/**
 * Stream chat response to client
 *
 * SECURITY:
 * - Gets user's actual permissions from database
 * - Gets user's branch memberships
 * - Tools use existing service functions that enforce security
 * - All data automatically filtered by tenant and branch membership
 *
 * RAG (Retrieval-Augmented Generation):
 * - Searches documentation for relevant context based on user query
 * - Injects relevant docs into system message for "how-to" questions
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

  // Get tenant info (for URL construction)
  const tenant = await prismaClientInstance.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantSlug: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
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

  // RAG: Search documentation for relevant context
  // Extract last user message text for search
  const lastMessage = messages[messages.length - 1];
  let lastUserText = '';
  if (lastMessage && lastMessage.role === 'user') {
    // Handle both string content and parts array format
    if (typeof lastMessage.content === 'string') {
      lastUserText = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      const textPart = lastMessage.content.find((p: any) => p.type === 'text');
      lastUserText = textPart?.text || '';
    }
  }

  // Search for relevant documentation (top 3 chunks, >0.7 similarity)
  const relevantDocs = lastUserText ? await searchDocumentation(lastUserText, 3, 0.7) : [];

  // Build system message with full context + RAG docs
  const systemMessage = buildSystemMessage({
    userName: user.userEmailAddress || 'User',
    ...(membership?.role.name ? { userRole: membership.role.name } : {}),
    permissions: permissionsArray,
    branchMemberships: branchMemberships.map(m => ({
      branchId: m.branchId,
      branchName: m.branch.branchName,
    })),
    tenantId,
    tenantSlug: tenant.tenantSlug, // NEW: Pass tenant slug for URL construction
    relevantDocs, // NEW: Pass relevant documentation
  });

  // Convert messages to model format (removes UI-specific fields)
  const modelMessages = convertToModelMessages(messages);

  // Stream response from OpenAI with all Phase 2 tools (20 tools across 8 categories)
  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemMessage,
    messages: modelMessages,
    tools: {
      ...transferTools({ userId, tenantId }),    // 3 tools: stock transfer queries
      ...productTools({ userId, tenantId }),      // 3 tools: product search and stock levels
      ...stockTools({ userId, tenantId }),        // 4 tools: stock management, movements, FIFO
      ...branchTools({ userId, tenantId }),       // 2 tools: branch info and stats
      ...userTools({ userId, tenantId }),         // 4 tools: user search, roles, permissions
      ...templateTools({ userId, tenantId }),     // 2 tools: transfer templates
      ...approvalTools({ userId, tenantId }),     // 2 tools: approval rules and explanation
      ...analyticsTools({ userId, tenantId }),    // 3 tools: metrics, performance, value reports
    },
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
