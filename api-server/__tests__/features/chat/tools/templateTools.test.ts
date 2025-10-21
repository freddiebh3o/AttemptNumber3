// api-server/__tests__/services/chat/templateTools.test.ts
import { templateTools } from '../../../../src/services/chat/tools/templateTools.js';
import * as templateService from '../../../../src/services/stockTransfers/templateService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../../helpers/factories.js';

describe('[CHAT-TEMPLATE-001] AI Chat Template Tools', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;
  let template1: Awaited<ReturnType<typeof templateService.createTransferTemplate>>;
  let template2: Awaited<ReturnType<typeof templateService.createTransferTemplate>>;

  beforeEach(async () => {
    // Create tenant and user
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Main Warehouse',
    });

    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Store A',
    });

    // Create role and membership
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['products:read', 'stock:read', 'stock:write'],
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    await addUserToBranch(testUser.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(testUser.id, testTenant.id, destinationBranch.id);

    // Create products
    product1 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Alpha',
      sku: 'WID-001',
      pricePence: 1500,
    });

    product2 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Beta',
      sku: 'WID-002',
      pricePence: 2000,
    });

    // Create templates
    template1 = await templateService.createTransferTemplate({
      tenantId: testTenant.id,
      userId: testUser.id,
      data: {
        name: 'Weekly Restock',
        description: 'Standard weekly restock from warehouse to store',
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        items: [
          { productId: product1.id, defaultQty: 100 },
          { productId: product2.id, defaultQty: 50 },
        ],
      },
    });

    template2 = await templateService.createTransferTemplate({
      tenantId: testTenant.id,
      userId: testUser.id,
      data: {
        name: 'Emergency Stock',
        description: 'Emergency stock transfer',
        sourceBranchId: sourceBranch.id,
        destinationBranchId: destinationBranch.id,
        items: [
          { productId: product1.id, defaultQty: 500 },
        ],
      },
    });
  });

  describe('[AC-TEMPLATE-001] listTemplates', () => {
    it('should list all templates', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({});

      expect(result.templates.length).toBeGreaterThanOrEqual(2);
      expect(result.templates.some((t) => t.name === 'Weekly Restock')).toBe(true);
      expect(result.templates.some((t) => t.name === 'Emergency Stock')).toBe(true);
    });

    it('should filter by source branch', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        sourceBranchId: sourceBranch.id,
      });

      expect(result.templates.every((t) => t.sourceBranch === 'Main Warehouse')).toBe(true);
    });

    it('should filter by destination branch', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        destinationBranchId: destinationBranch.id,
      });

      expect(result.templates.every((t) => t.destinationBranch === 'Store A')).toBe(true);
    });

    it('should search by name or description', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        query: 'Emergency',
      });

      expect(result.templates.some((t) => t.name === 'Emergency Stock')).toBe(true);
    });

    it('should show item count for each template', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({});

      const weeklyTemplate = result.templates.find((t) => t.name === 'Weekly Restock');
      expect(weeklyTemplate?.itemCount).toBe(2);

      const emergencyTemplate = result.templates.find((t) => t.name === 'Emergency Stock');
      expect(emergencyTemplate?.itemCount).toBe(1);
    });

    it('should show created by user', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({});

      expect(result.templates.every((t) => t.createdBy === testUser.userEmailAddress)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        limit: 1,
      });

      expect(result.templates.length).toBeLessThanOrEqual(1);
    });

    it('should cap limit at 20', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        limit: 50,
      });

      expect(result.templates.length).toBeLessThanOrEqual(20);
    });

    it('should return empty result when no templates found', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        query: 'NonExistentTemplate12345',
      });

      expect(result.templates).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.message).toBe('No templates found');
    });
  });

  describe('[AC-TEMPLATE-002] getTemplateDetails', () => {
    it('should get full template details', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: template1.id,
      });

      expect(result.id).toBe(template1.id);
      expect(result.name).toBe('Weekly Restock');
      expect(result.description).toBe('Standard weekly restock from warehouse to store');
    });

    it('should show source and destination branch details', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: template1.id,
      });

      expect(result.sourceBranch.name).toBe('Main Warehouse');
      expect(result.destinationBranch.name).toBe('Store A');
    });

    it('should list all items with products and quantities', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: template1.id,
      });

      expect(result.items.length).toBe(2);

      const item1 = result.items.find((i) => i.sku === 'WID-001');
      expect(item1?.product).toBe('Widget Alpha');
      expect(item1?.defaultQty).toBe(100);
      expect(item1?.price).toBe('£15.00');

      const item2 = result.items.find((i) => i.sku === 'WID-002');
      expect(item2?.product).toBe('Widget Beta');
      expect(item2?.defaultQty).toBe(50);
      expect(item2?.price).toBe('£20.00');
    });

    it('should calculate total template value', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: template1.id,
      });

      // (100 * £15) + (50 * £20) = £1500 + £1000 = £2500
      expect(result.totalValue).toBe('£2500.00');
    });

    it('should show item count', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: template1.id,
      });

      expect(result.itemCount).toBe(2);
    });

    it('should show created by and timestamps', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: template1.id,
      });

      expect(result.createdBy).toBe(testUser.userEmailAddress);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should return error if template not found', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: 'non-existent-id',
      });

      expect(result.error).toBe('Unable to get template details');
    });

    it('should handle template with description as null', async () => {
      // Create template without description
      const templateWithoutDesc = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          name: 'No Description Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: templateWithoutDesc.id,
      });

      expect(result.description).toBe('No description');
    });
  });

  describe('[AC-TEMPLATE-003] Security - Tenant Isolation', () => {
    it('should not list templates from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherBranch1 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherBranch2 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const role = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: role.id,
      });

      const otherTemplate = await templateService.createTransferTemplate({
        tenantId: otherTenant.id,
        userId: otherUser.id,
        data: {
          name: 'Other Tenant Template',
          sourceBranchId: otherBranch1.id,
          destinationBranchId: otherBranch2.id,
          items: [{ productId: otherProduct.id, defaultQty: 10 }],
        },
      });

      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({});

      expect(result.templates.some((t) => t.id === otherTemplate.id)).toBe(false);
    });

    it('should not get template details from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherBranch1 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherBranch2 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      const role = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['stock:write'],
      });
      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: role.id,
      });

      const otherTemplate = await templateService.createTransferTemplate({
        tenantId: otherTenant.id,
        userId: otherUser.id,
        data: {
          name: 'Other Tenant Template',
          sourceBranchId: otherBranch1.id,
          destinationBranchId: otherBranch2.id,
          items: [{ productId: otherProduct.id, defaultQty: 10 }],
        },
      });

      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getTemplateDetails.execute({
        templateId: otherTemplate.id,
      });

      expect(result.error).toBe('Unable to get template details');
    });
  });

  describe('[AC-TEMPLATE-004] Pagination', () => {
    it('should indicate if more templates are available', async () => {
      const tools = templateTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listTemplates.execute({
        limit: 1,
      });

      if (result.count >= 1) {
        expect(result.hasMore).toBeDefined();
      }
    });
  });
});
