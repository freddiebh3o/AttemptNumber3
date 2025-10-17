// admin-web/src/api/chatAnalytics.ts
import { httpRequestJson } from "./http";

export interface ChatAnalyticsSummary {
  totalConversations: number;
  totalMessages: number;
  uniqueUsers: number;
  averageMessagesPerConversation: number;
  toolCallsSummary: Record<string, number>;
  topTools: Array<{ name: string; count: number }>;
  totalToolCalls: number;
  dailyData: Array<{
    id: string;
    tenantId: string;
    date: string;
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    toolCalls: Record<string, number> | null;
    avgMessagesPerConversation: number | null;
    avgResponseTimeMs: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Get chat analytics summary for date range
 */
export async function getChatAnalyticsApiRequest(params?: {
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}): Promise<SuccessResponse<ChatAnalyticsSummary>> {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);
  const qs = search.toString();

  return httpRequestJson<SuccessResponse<ChatAnalyticsSummary>>(
    `/api/chat/analytics${qs ? `?${qs}` : ""}`
  );
}
