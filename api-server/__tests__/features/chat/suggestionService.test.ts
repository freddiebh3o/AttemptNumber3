// api-server/__tests__/services/chat/suggestionService.test.ts
import { describe, it, expect } from '@jest/globals';
import { createTestTenant, createTestUser, createTestBranch, createTestRoleWithPermissions } from '../../helpers/factories.js';
import * as suggestionService from '../../../src/services/chat/suggestionService.js';
import { prismaClientInstance } from '../../../src/db/prismaClient.js';

describe('Chat Suggestion Service', () => {
  describe('getSuggestionsForUser', () => {
    it('should return array of suggestions with required fields', async () => {
      const tenant = await createTestTenant({ name: 'Test Corp' });
      const user = await createTestUser();

      // Create OWNER role with all permissions
      const role = await createTestRoleWithPermissions({
        name: 'OWNER',
        tenantId: tenant.id,
        permissionKeys: ['products:read', 'products:write', 'stock:read', 'stock:write', 'reports:view', 'users:manage'],
      });

      // Add user to tenant as OWNER
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsForUser({
        userId: user.id,
        tenantId: tenant.id,
      });

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      // Each suggestion should have required fields
      suggestions.forEach(s => {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('text');
        expect(s).toHaveProperty('category');
        expect(typeof s.id).toBe('string');
        expect(typeof s.text).toBe('string');
        expect(['products', 'stock', 'transfers', 'analytics', 'users', 'general']).toContain(s.category);
      });
    });

    it('should include product suggestions for user with products:read', async () => {
      const tenant = await createTestTenant({ name: 'Product Corp' });
      const user = await createTestUser();

      // Create role with products:read permission
      const role = await createTestRoleWithPermissions({
        name: 'Product Reader',
        tenantId: tenant.id,
        permissionKeys: ['products:read'],
      });

      // Add user to tenant with role
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsForUser({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Should have at least one product suggestion
      const productSuggestions = suggestions.filter(s => s.category === 'products');
      expect(productSuggestions.length).toBeGreaterThan(0);
    });

    it('should include stock suggestions for user with branch membership', async () => {
      const tenant = await createTestTenant({ name: 'Stock Corp' });
      const user = await createTestUser();
      const branch = await createTestBranch({ name: 'Main Warehouse', tenantId: tenant.id });

      // Create role with stock:read permission
      const role = await createTestRoleWithPermissions({
        name: 'Stock Reader',
        tenantId: tenant.id,
        permissionKeys: ['stock:read'],
      });

      // Add user to tenant
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      // Add user to branch
      await prismaClientInstance.userBranchMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          branchId: branch.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsForUser({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Should have stock suggestions
      const stockSuggestions = suggestions.filter(s => s.category === 'stock');
      expect(stockSuggestions.length).toBeGreaterThan(0);

      // Should reference the branch name
      const branchSuggestion = suggestions.find(s => s.text.includes('Main Warehouse'));
      expect(branchSuggestion).toBeDefined();
    });

    it('should include analytics suggestions for user with reports:view', async () => {
      const tenant = await createTestTenant({ name: 'Analytics Corp' });
      const user = await createTestUser();

      // Create role with reports:view permission
      const role = await createTestRoleWithPermissions({
        name: 'Reporter',
        tenantId: tenant.id,
        permissionKeys: ['reports:view'],
      });

      // Add user to tenant
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsForUser({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Should have analytics suggestions
      const analyticsSuggestions = suggestions.filter(s => s.category === 'analytics');
      expect(analyticsSuggestions.length).toBeGreaterThan(0);
    });

    it('should always include general help suggestion', async () => {
      const tenant = await createTestTenant({ name: 'Help Corp' });
      const user = await createTestUser();

      // Create role with no permissions
      const role = await createTestRoleWithPermissions({
        name: 'No Perms',
        tenantId: tenant.id,
        permissionKeys: [],
      });

      // Add user to tenant
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsForUser({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Should have at least the help suggestion
      expect(suggestions.length).toBeGreaterThan(0);

      const helpSuggestion = suggestions.find(s => s.text.includes('What can you help'));
      expect(helpSuggestion).toBeDefined();
      expect(helpSuggestion?.category).toBe('general');
    });

    it('should respect limit parameter', async () => {
      const tenant = await createTestTenant({ name: 'Limit Corp' });
      const user = await createTestUser();

      // Create OWNER role
      const role = await createTestRoleWithPermissions({
        name: 'OWNER',
        tenantId: tenant.id,
        permissionKeys: ['products:read', 'stock:read', 'reports:view'],
      });

      // Add user as OWNER
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsForUser({
        userId: user.id,
        tenantId: tenant.id,
        limit: 3,
      });

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getSuggestionsByCategory', () => {
    it('should filter suggestions by category', async () => {
      const tenant = await createTestTenant({ name: 'Category Corp' });
      const user = await createTestUser();

      // Create OWNER role
      const role = await createTestRoleWithPermissions({
        name: 'OWNER',
        tenantId: tenant.id,
        permissionKeys: ['products:read', 'stock:read', 'reports:view'],
      });

      // Add user as OWNER
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const productSuggestions = await suggestionService.getSuggestionsByCategory({
        userId: user.id,
        tenantId: tenant.id,
        category: 'products',
      });

      expect(Array.isArray(productSuggestions)).toBe(true);
      productSuggestions.forEach(s => {
        expect(s.category).toBe('products');
      });
    });

    it('should respect limit for category filtering', async () => {
      const tenant = await createTestTenant({ name: 'Limit Category Corp' });
      const user = await createTestUser();

      // Create role with basic permissions
      const role = await createTestRoleWithPermissions({
        name: 'Basic User',
        tenantId: tenant.id,
        permissionKeys: [],
      });

      // Add user as basic user
      await prismaClientInstance.userTenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: role.id,
        },
      });

      const suggestions = await suggestionService.getSuggestionsByCategory({
        userId: user.id,
        tenantId: tenant.id,
        category: 'general',
        limit: 2,
      });

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });
});
