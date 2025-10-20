// api-server/src/services/chat/apiKeyService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import type { TenantFeatureFlags } from '../../types/tenant.js';

/**
 * Get the OpenAI API key to use for this tenant
 *
 * Priority:
 * 1. If chatAssistantEnabled is true AND tenant has openaiApiKey, use tenant key
 * 2. Otherwise, fall back to server's OPENAI_API_KEY from env
 * 3. If neither exists, return null
 *
 * @param params.tenantId - The tenant ID
 * @returns OpenAI API key or null if unavailable
 */
export async function getOpenAIApiKey({
  tenantId,
}: {
  tenantId: string;
}): Promise<string | null> {
  // Get tenant's feature flags
  const tenant = await prismaClientInstance.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const featureFlags = (tenant.featureFlags as TenantFeatureFlags | null) || {};

  // If chat assistant is enabled and tenant has their own API key, use it
  if (featureFlags.chatAssistantEnabled && featureFlags.openaiApiKey) {
    return featureFlags.openaiApiKey;
  }

  // Otherwise, fall back to server's API key
  const serverApiKey = process.env.OPENAI_API_KEY;
  if (serverApiKey) {
    return serverApiKey;
  }

  // No API key available
  return null;
}
