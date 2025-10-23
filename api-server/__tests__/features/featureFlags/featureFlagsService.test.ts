/**
 * Tests for Tenant Feature Flags Service
 * Tests the getOpenAIApiKey utility and feature flags CRUD
 *
 * UPDATED: Removed server API key fallback tests (enforced custom keys only)
 */

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { createTestTenant } from '../../helpers/factories.js';
import { getOpenAIApiKey } from '../../../src/services/chat/apiKeyService.js';
import {
  getTenantFeatureFlagsService,
  updateTenantFeatureFlagsService,
} from '../../../src/services/tenantFeatureFlagsService.js';

const prisma = new PrismaClient();

describe('[FEATURE-FLAGS-SVC] Tenant Feature Flags Service', () => {
  let testTenant: any;

  beforeAll(async () => {
    testTenant = await createTestTenant({ slug: `feature-flags-test-${Date.now()}` });
  });

  afterAll(async () => {
    // Cleanup
    if (testTenant) {
      await prisma.tenant.delete({ where: { id: testTenant.id } });
    }
    await prisma.$disconnect();
  });

  describe('getOpenAIApiKey - Get OpenAI API Key', () => {
    test('should return tenant key when chatAssistantEnabled is true and key exists', async () => {
      // Set tenant key
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-tenant-custom-key',
          },
        },
      });

      const apiKey = await getOpenAIApiKey({ tenantId: testTenant.id });

      expect(apiKey).toBe('sk-tenant-custom-key');
    });

    test('should return null when chatAssistantEnabled is false', async () => {
      // Set tenant key but disable feature
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: false,
            openaiApiKey: 'sk-tenant-disabled-key',
          },
        },
      });

      const apiKey = await getOpenAIApiKey({ tenantId: testTenant.id });

      expect(apiKey).toBeNull();
    });

    test('should return null when chatAssistantEnabled is true but no key', async () => {
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: null,
          },
        },
      });

      const apiKey = await getOpenAIApiKey({ tenantId: testTenant.id });

      expect(apiKey).toBeNull();
    });

    test('should return null when key is empty string', async () => {
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: '',
          },
        },
      });

      const apiKey = await getOpenAIApiKey({ tenantId: testTenant.id });

      expect(apiKey).toBeNull();
    });

    test('should throw error for non-existent tenant', async () => {
      await expect(
        getOpenAIApiKey({ tenantId: 'non-existent-id' })
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('getTenantFeatureFlagsService - Get Feature Flags', () => {
    test('should return default flags for tenant with no flags set', async () => {
      const tenant = await createTestTenant({ slug: `flags-get-test-${Date.now()}` });

      const flags = await getTenantFeatureFlagsService({ tenantId: tenant.id });

      expect(flags).toEqual({
        chatAssistantEnabled: false,
        openaiApiKey: null,
        barcodeScanningEnabled: false,
      });

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should return existing flags for tenant with flags set', async () => {
      const tenant = await createTestTenant({ slug: `flags-existing-${Date.now()}` });

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-test-key',
            barcodeScanningEnabled: true,
          },
        },
      });

      const flags = await getTenantFeatureFlagsService({ tenantId: tenant.id });

      expect(flags).toEqual({
        chatAssistantEnabled: true,
        openaiApiKey: 'sk-test-key',
        barcodeScanningEnabled: true,
      });

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should throw error for non-existent tenant', async () => {
      await expect(
        getTenantFeatureFlagsService({ tenantId: 'non-existent-id' })
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('updateTenantFeatureFlagsService - Update Feature Flags', () => {
    test('should throw error when enabling chat assistant without API key', async () => {
      const tenant = await createTestTenant({ slug: `flags-no-key-${Date.now()}` });

      await expect(
        updateTenantFeatureFlagsService({
          tenantId: tenant.id,
          updates: { chatAssistantEnabled: true },
        })
      ).rejects.toThrow('Cannot enable AI Chat Assistant without providing an OpenAI API key');

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should allow enabling chat assistant with valid key', async () => {
      const tenant = await createTestTenant({ slug: `flags-with-key-${Date.now()}` });

      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: {
          chatAssistantEnabled: true,
          openaiApiKey: 'sk-valid-key-123',
        },
      });

      expect(updated.chatAssistantEnabled).toBe(true);
      expect(updated.openaiApiKey).toBe('sk-valid-key-123');

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should allow disabling chat assistant without key', async () => {
      const tenant = await createTestTenant({ slug: `flags-disable-${Date.now()}` });

      // First enable with key
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-old-key',
          },
        },
      });

      // Now disable without providing key
      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { chatAssistantEnabled: false },
      });

      expect(updated.chatAssistantEnabled).toBe(false);
      expect(updated.openaiApiKey).toBe('sk-old-key'); // Unchanged

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should validate OpenAI API key format (must start with sk-)', async () => {
      const tenant = await createTestTenant({ slug: `flags-validation-${Date.now()}` });

      await expect(
        updateTenantFeatureFlagsService({
          tenantId: tenant.id,
          updates: { openaiApiKey: 'invalid-key-format' },
        })
      ).rejects.toThrow('Invalid OpenAI API key format');

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should allow partial updates', async () => {
      const tenant = await createTestTenant({ slug: `flags-partial-${Date.now()}` });

      // Set initial state
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-initial-key',
            barcodeScanningEnabled: false,
          },
        },
      });

      // Update only barcode scanning
      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { barcodeScanningEnabled: true },
      });

      expect(updated.chatAssistantEnabled).toBe(true); // Unchanged
      expect(updated.openaiApiKey).toBe('sk-initial-key'); // Unchanged
      expect(updated.barcodeScanningEnabled).toBe(true); // Updated

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should allow setting key to null after previously set', async () => {
      const tenant = await createTestTenant({ slug: `flags-null-key-${Date.now()}` });

      // Set a key first
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: false, // Disabled
            openaiApiKey: 'sk-old-key',
          },
        },
      });

      // Now clear it (while chat is disabled)
      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { openaiApiKey: null },
      });

      expect(updated.openaiApiKey).toBeNull();
      expect(updated.chatAssistantEnabled).toBe(false);

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should throw error when trying to clear key while chat is enabled', async () => {
      const tenant = await createTestTenant({ slug: `flags-clear-enabled-${Date.now()}` });

      // Set chat enabled with key
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-current-key',
          },
        },
      });

      // Try to clear key while chat is enabled - should fail
      await expect(
        updateTenantFeatureFlagsService({
          tenantId: tenant.id,
          updates: { openaiApiKey: null },
        })
      ).rejects.toThrow('Cannot enable AI Chat Assistant without providing an OpenAI API key');

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should throw error for non-existent tenant', async () => {
      await expect(
        updateTenantFeatureFlagsService({
          tenantId: 'non-existent-id',
          updates: { chatAssistantEnabled: true },
        })
      ).rejects.toThrow('Tenant not found');
    });

    test('should update barcode scanning flag independently', async () => {
      const tenant = await createTestTenant({ slug: `flags-barcode-${Date.now()}` });

      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { barcodeScanningEnabled: true },
      });

      expect(updated.barcodeScanningEnabled).toBe(true);
      expect(updated.chatAssistantEnabled).toBe(false);
      expect(updated.openaiApiKey).toBeNull();

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });
  });
});
