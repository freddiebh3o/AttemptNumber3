// admin-web/src/api/conversations.ts
import { httpRequestJson } from "./http";

// Types for conversation API
// TODO: Generate these from OpenAPI schema once added to backend

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: string; // 'user' | 'assistant' | 'system'
  content: any; // UIMessage content (string or parts array)
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  userId: string;
  tenantId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * List all conversations for the current user
 */
export async function listConversationsApiRequest(params?: {
  limit?: number;
}): Promise<SuccessResponse<ChatConversation[]>> {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();

  return httpRequestJson<SuccessResponse<ChatConversation[]>>(
    `/api/chat/conversations${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get a conversation by ID with all messages
 */
export async function getConversationApiRequest(params: {
  conversationId: string;
}): Promise<SuccessResponse<ChatConversationWithMessages>> {
  return httpRequestJson<SuccessResponse<ChatConversationWithMessages>>(
    `/api/chat/conversations/${params.conversationId}`
  );
}

/**
 * Delete a conversation
 */
export async function deleteConversationApiRequest(params: {
  conversationId: string;
}): Promise<SuccessResponse<{ deleted: boolean }>> {
  return httpRequestJson<SuccessResponse<{ deleted: boolean }>>(
    `/api/chat/conversations/${params.conversationId}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Update conversation title
 */
export async function updateConversationTitleApiRequest(params: {
  conversationId: string;
  title: string;
}): Promise<SuccessResponse<ChatConversation>> {
  return httpRequestJson<SuccessResponse<ChatConversation>>(
    `/api/chat/conversations/${params.conversationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title: params.title }),
    }
  );
}
