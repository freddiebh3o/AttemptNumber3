/**
 * Tests for Tenant Feature Flags Service
 * Tests the getOpenAIApiKey utility and feature flags CRUD
 */

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { createTestTenant } from '../helpers/factories.js';
import { getOpenAIApiKey } from '../../src/services/chat/apiKeyService.js';
import {
  getTenantFeatureFlagsService,
  updateTenantFeatureFlagsService,
} from '../../src/services/tenantFeatureFlagsService.js';

const prisma = new PrismaClient();

describe('Tenant Feature Flags Service', () => {
  let testTenant: any;
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeAll(async () => {
    testTenant = await createTestTenant({ slug: `feature-flags-test-${Date.now()}` });
  });

  afterAll(async () => {
    // Cleanup
    if (testTenant) {
      await prisma.tenant.delete({ where: { id: testTenant.id } });
    }
    await prisma.$disconnect();
    // Restore original env var
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  describe('getOpenAIApiKey', () => {
    test('should return server API key when tenant has no key', async () => {
      process.env.OPENAI_API_KEY = 'sk-server-test-key';

      const apiKey = await getOpenAIApiKey({ tenantId: testTenant.id });

      expect(apiKey).toBe('sk-server-test-key');
    });

    test('should return null when neither tenant nor server has key', async () => {
      delete process.env.OPENAI_API_KEY;

      const apiKey = await getOpenAIApiKey({ tenantId: testTenant.id });

      expect(apiKey).toBeNull();
    });

    test('should return tenant key when chatAssistantEnabled is true and key exists', async () => {
      process.env.OPENAI_API_KEY = 'sk-server-key';

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

    test('should return server key when chatAssistantEnabled is false even if tenant has key', async () => {
      process.env.OPENAI_API_KEY = 'sk-server-fallback';

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

      expect(apiKey).toBe('sk-server-fallback');
    });

    test('should return server key when tenant key is null', async () => {
      process.env.OPENAI_API_KEY = 'sk-server-default';

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

      expect(apiKey).toBe('sk-server-default');
    });

    test('should throw error for non-existent tenant', async () => {
      await expect(
        getOpenAIApiKey({ tenantId: 'non-existent-id' })
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('getTenantFeatureFlagsService', () => {
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

  describe('updateTenantFeatureFlagsService', () => {
    test('should update feature flags (partial update)', async () => {
      const tenant = await createTestTenant({ slug: `flags-update-${Date.now()}` });

      // Set initial flags
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: false,
            openaiApiKey: null,
            barcodeScanningEnabled: false,
          },
        },
      });

      // Update only chatAssistantEnabled
      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { chatAssistantEnabled: true },
      });

      expect(updated.chatAssistantEnabled).toBe(true);
      expect(updated.openaiApiKey).toBeNull();
      expect(updated.barcodeScanningEnabled).toBe(false);

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should update OpenAI API key', async () => {
      const tenant = await createTestTenant({ slug: `flags-api-key-${Date.now()}` });

      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: {
          chatAssistantEnabled: true,
          openaiApiKey: 'sk-new-custom-key',
        },
      });

      expect(updated.chatAssistantEnabled).toBe(true);
      expect(updated.openaiApiKey).toBe('sk-new-custom-key');

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

    test('should allow setting API key to null', async () => {
      const tenant = await createTestTenant({ slug: `flags-null-key-${Date.now()}` });

      // Set a key first
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          featureFlags: {
            chatAssistantEnabled: true,
            openaiApiKey: 'sk-old-key',
          },
        },
      });

      // Now clear it
      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { openaiApiKey: null },
      });

      expect(updated.openaiApiKey).toBeNull();

      // Cleanup
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    test('should update barcode scanning flag', async () => {
      const tenant = await createTestTenant({ slug: `flags-barcode-${Date.now()}` });

      const updated = await updateTenantFeatureFlagsService({
        tenantId: tenant.id,
        updates: { barcodeScanningEnabled: true },
      });

      expect(updated.barcodeScanningEnabled).toBe(true);

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
  });
});
