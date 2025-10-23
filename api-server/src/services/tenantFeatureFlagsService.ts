// api-server/src/services/tenantFeatureFlagsService.ts
import { prismaClientInstance } from '../db/prismaClient.js';
import type { TenantFeatureFlags } from '../types/tenant.js';
import { Errors } from '../utils/httpErrors.js';

/**
 * Get tenant feature flags
 */
export async function getTenantFeatureFlagsService({
  tenantId,
}: {
  tenantId: string;
}): Promise<TenantFeatureFlags> {
  const tenant = await prismaClientInstance.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });

  if (!tenant) {
    throw Errors.notFound('Tenant not found');
  }

  const flags = (tenant.featureFlags as TenantFeatureFlags | null) || {};

  return {
    chatAssistantEnabled: flags.chatAssistantEnabled ?? false,
    openaiApiKey: flags.openaiApiKey ?? null,
    barcodeScanningEnabled: flags.barcodeScanningEnabled ?? false,
  };
}

/**
 * Update tenant feature flags
 *
 * Validates:
 * - OpenAI API key format (must start with 'sk-' if provided)
 * - Cannot enable chat assistant without providing an API key
 * - Merges with existing flags (partial update)
 */
export async function updateTenantFeatureFlagsService({
  tenantId,
  updates,
}: {
  tenantId: string;
  updates: Partial<TenantFeatureFlags>;
}): Promise<TenantFeatureFlags> {
  // Validate OpenAI API key format if provided
  if (updates.openaiApiKey !== undefined && updates.openaiApiKey !== null) {
    if (!updates.openaiApiKey.startsWith('sk-')) {
      throw Errors.validation(
        'Invalid OpenAI API key format',
        'API key must start with "sk-"'
      );
    }
  }

  // Get current flags
  const tenant = await prismaClientInstance.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });

  if (!tenant) {
    throw Errors.notFound('Tenant not found');
  }

  const currentFlags = (tenant.featureFlags as TenantFeatureFlags | null) || {};

  // Merge with updates (partial update)
  const updatedFlags: TenantFeatureFlags = {
    ...currentFlags,
    ...updates,
  };

  // Validate: Cannot enable chat assistant without an API key
  if (updatedFlags.chatAssistantEnabled) {
    if (!updatedFlags.openaiApiKey) {
      throw Errors.validation(
        'Cannot enable AI Chat Assistant without providing an OpenAI API key',
        'Please provide a valid OpenAI API key (starting with "sk-") to enable the chat assistant'
      );
    }
  }

  // Update in database
  await prismaClientInstance.tenant.update({
    where: { id: tenantId },
    data: { featureFlags: updatedFlags as any },
  });

  return {
    chatAssistantEnabled: updatedFlags.chatAssistantEnabled ?? false,
    openaiApiKey: updatedFlags.openaiApiKey ?? null,
    barcodeScanningEnabled: updatedFlags.barcodeScanningEnabled ?? false,
  };
}

/**
 * Ensure tenant ID matches the slug and the current session's tenant
 * (Used in routes to prevent cross-tenant access)
 */
export async function ensureTenantIdForSlugAndSession(
  tenantSlug: string,
  sessionTenantId?: string
): Promise<string> {
  const tenant = await prismaClientInstance.tenant.findUnique({
    where: { tenantSlug },
    select: { id: true },
  });

  if (!tenant) {
    throw Errors.notFound('Tenant not found');
  }

  if (sessionTenantId && tenant.id !== sessionTenantId) {
    throw Errors.permissionDenied();
  }

  return tenant.id;
}
