// admin-web/src/api/chatSuggestions.ts
import { httpRequestJson } from './http';

export interface ChatSuggestion {
  id: string;
  text: string;
  category: 'products' | 'stock' | 'transfers' | 'analytics' | 'users' | 'general';
  icon?: string;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Get smart suggestions for current user
 */
export async function getSuggestionsForUser(params?: {
  limit?: number;
}): Promise<ChatSuggestion[]> {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const qs = search.toString();

  const response = await httpRequestJson<SuccessResponse<ChatSuggestion[]>>(
    `/api/chat/suggestions${qs ? `?${qs}` : ''}`
  );

  return response.data;
}

/**
 * Get suggestions by category
 */
export async function getSuggestionsByCategory(params: {
  category: ChatSuggestion['category'];
  limit?: number;
}): Promise<ChatSuggestion[]> {
  const search = new URLSearchParams();
  search.set('category', params.category);
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }

  const response = await httpRequestJson<SuccessResponse<ChatSuggestion[]>>(
    `/api/chat/suggestions?${search.toString()}`
  );

  return response.data;
}
