// api-server/src/services/chat/apiKeyService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import type { TenantFeatureFlags } from '../../types/tenant.js';

/**
 * Get the OpenAI API key to use for this tenant
 *
 * Returns the tenant's custom OpenAI API key if the chat assistant is enabled and a key is configured.
 * No server-level fallback is used - tenants MUST provide their own API key to use the chat assistant.
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

  // Only return tenant's API key if chat assistant is enabled AND key exists
  if (featureFlags.chatAssistantEnabled && featureFlags.openaiApiKey) {
    return featureFlags.openaiApiKey;
  }

  // No API key available (no server fallback)
  return null;
}
