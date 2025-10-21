// api-server/__tests__/services/stockTransferTemplates.test.ts
/**
 * [ST-010] Stock Transfer Templates Service Tests
 *
 * Tests the template CRUD service layer:
 * - createTransferTemplate
 * - listTransferTemplates
 * - getTransferTemplate
 * - updateTransferTemplate
 * - deleteTransferTemplate
 * - duplicateTransferTemplate
 *
 * These tests verify:
 * - Template creation with items
 * - Filtering (by name, branches)
 * - Update operations
 * - Delete operations
 * - Duplication logic
 * - Multi-tenant isolation
 * - Permission validation
 */

import * as templateService from '../../../../src/services/stockTransfers/templateService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
} from '../../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../../src/db/prismaClient.js';

describe('[ST-010] Stock Transfer Templates Service', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {

    // Create tenant - use factory default for unique slug
    testTenant = await createTestTenant();

    // Create user - use factory default for unique email
    user = await createTestUser();

    // Create branches - use factory defaults for unique names/slugs
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
    });
    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create products - use factory defaults for unique names/SKUs
    product1 = await createTestProduct({
      tenantId: testTenant.id,
    });
    product2 = await createTestProduct({
      tenantId: testTenant.id,
    });
  });

  describe('[AC-010-1] createTransferTemplate', () => {
    it('should create template with name, description, and items', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Weekly Restock',
          description: 'Standard weekly transfer from warehouse to store',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, defaultQty: 100 },
            { productId: product2.id, defaultQty: 50 },
          ],
        },
      });

      expect(template.name).toBe('Weekly Restock');
      expect(template.description).toBe('Standard weekly transfer from warehouse to store');
      expect(template.sourceBranchId).toBe(sourceBranch.id);
      expect(template.destinationBranchId).toBe(destinationBranch.id);
      expect(template.createdByUserId).toBe(user.id);
      expect(template.items).toHaveLength(2);
      expect(template.items[0]?.productId).toBe(product1.id);
      expect(template.items[0]?.defaultQty).toBe(100);
      expect(template.items[1]?.productId).toBe(product2.id);
      expect(template.items[1]?.defaultQty).toBe(50);
    });

    it('should create template without description (optional)', async () => {
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Simple Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 25 }],
        },
      });

      expect(template.name).toBe('Simple Template');
      expect(template.description).toBeNull();
      expect(template.items).toHaveLength(1);
    });

    it('should reject if source and destination are the same', async () => {
      await expect(
        templateService.createTransferTemplate({
          tenantId: testTenant.id,
          userId: user.id,
          data: {
            name: 'Invalid Template',
            sourceBranchId: sourceBranch.id,
            destinationBranchId: sourceBranch.id, // Same as source
            items: [{ productId: product1.id, defaultQty: 10 }],
          },
        })
      ).rejects.toThrow('Source and destination branches must be different');
    });

    it('should reject if no items provided', async () => {
      await expect(
        templateService.createTransferTemplate({
          tenantId: testTenant.id,
          userId: user.id,
          data: {
            name: 'Empty Template',
            sourceBranchId: sourceBranch.id,
            destinationBranchId: destinationBranch.id,
            items: [],
          },
        })
      ).rejects.toThrow('Template must include at least one item');
    });

    it('should reject if product does not exist', async () => {
      await expect(
        templateService.createTransferTemplate({
          tenantId: testTenant.id,
          userId: user.id,
          data: {
            name: 'Invalid Product Template',
            sourceBranchId: sourceBranch.id,
            destinationBranchId: destinationBranch.id,
            items: [{ productId: 'non-existent-product-id', defaultQty: 10 }],
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('[AC-010-2] listTransferTemplates', () => {
    beforeEach(async () => {
      // Create test templates
      await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Weekly Restock',
          description: 'Weekly transfer',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 100 }],
        },
      });

      await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Emergency Restock',
          description: 'Urgent transfer',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product2.id, defaultQty: 50 }],
        },
      });
    });

    it('should list all templates for tenant', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.name).toBeDefined();
      expect(result.items[0]?.items).toBeDefined();
    });

    it('should filter templates by search query (name)', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { q: 'Emergency' },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Emergency Restock');
    });

    it('should filter templates by source branch', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { sourceBranchId: sourceBranch.id },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((t) => t.sourceBranchId === sourceBranch.id)).toBe(true);
    });

    it('should filter templates by destination branch', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { destinationBranchId: destinationBranch.id },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((t) => t.destinationBranchId === destinationBranch.id)).toBe(true);
    });

    it('should support pagination with limit', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { limit: 1 },
      });

      expect(result.items).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.nextCursor).toBeDefined();
    });

    it('should isolate templates by tenant', async () => {
      // Create another tenant with templates - use factory defaults
      const otherTenant = await createTestTenant();
      const otherBranch1 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherBranch2 = await createTestBranch({
        tenantId: otherTenant.id,
      });
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
      });

      await templateService.createTransferTemplate({
        tenantId: otherTenant.id,
        userId: user.id,
        data: {
          name: 'Other Tenant Template',
          sourceBranchId: otherBranch1.id,
          destinationBranchId: otherBranch2.id,
          items: [{ productId: otherProduct.id, defaultQty: 10 }],
        },
      });

      // List templates for original tenant
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((t) => t.tenantId === testTenant.id)).toBe(true);
    });
  });

  describe('[AC-010-3] getTransferTemplate', () => {
    it('should get template by ID with items', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Test Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, defaultQty: 75 },
            { productId: product2.id, defaultQty: 25 },
          ],
        },
      });

      const retrieved = await templateService.getTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
      });

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test Template');
      expect(retrieved.items).toHaveLength(2);
      expect(retrieved.sourceBranch).toBeDefined();
      expect(retrieved.destinationBranch).toBeDefined();
      expect(retrieved.createdByUser).toBeDefined();
    });

    it('should reject if template does not exist', async () => {
      await expect(
        templateService.getTransferTemplate({
          tenantId: testTenant.id,
          templateId: 'non-existent-id',
        })
      ).rejects.toThrow('Template not found');
    });

    it('should reject if template belongs to different tenant', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Test Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const otherTenant = await createTestTenant();

      await expect(
        templateService.getTransferTemplate({
          tenantId: otherTenant.id,
          templateId: created.id,
        })
      ).rejects.toThrow('Template not found');
    });
  });

  describe('[AC-010-4] updateTransferTemplate', () => {
    it('should update template name and description', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Old Name',
          description: 'Old description',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const updated = await templateService.updateTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
        data: {
          name: 'New Name',
          description: 'New description',
        },
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New description');
      expect(updated.sourceBranchId).toBe(sourceBranch.id); // Unchanged
    });

    it('should update template branches', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const newSource = await createTestBranch({
        tenantId: testTenant.id,
      });

      const updated = await templateService.updateTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
        data: {
          sourceBranchId: newSource.id,
        },
      });

      expect(updated.sourceBranchId).toBe(newSource.id);
      expect(updated.destinationBranchId).toBe(destinationBranch.id); // Unchanged
    });

    it('should update template items', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const updated = await templateService.updateTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
        data: {
          items: [
            { productId: product1.id, defaultQty: 20 }, // Changed qty
            { productId: product2.id, defaultQty: 30 }, // Added new item
          ],
        },
      });

      expect(updated.items).toHaveLength(2);
      expect(updated.items.find((i) => i.productId === product1.id)?.defaultQty).toBe(20);
      expect(updated.items.find((i) => i.productId === product2.id)?.defaultQty).toBe(30);
    });

    it('should reject if source and destination become the same', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      await expect(
        templateService.updateTransferTemplate({
          tenantId: testTenant.id,
          templateId: created.id,
          data: {
            destinationBranchId: sourceBranch.id, // Same as source
          },
        })
      ).rejects.toThrow('Source and destination branches must be different');
    });
  });

  describe('[AC-010-5] deleteTransferTemplate (Archive)', () => {
    it('should archive template (soft delete)', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Template to Archive',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, defaultQty: 10 },
            { productId: product2.id, defaultQty: 20 },
          ],
        },
      });

      const archived = await templateService.deleteTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
        userId: user.id,
      });

      // Template should be archived
      expect(archived.isArchived).toBe(true);
      expect(archived.archivedAt).toBeDefined();
      expect(archived.archivedByUserId).toBe(user.id);

      // Template items should still exist (not cascade deleted)
      const items = await prisma.stockTransferTemplateItem.findMany({
        where: { templateId: created.id },
      });
      expect(items).toHaveLength(2);
    });

    it('should reject if template does not exist', async () => {
      await expect(
        templateService.deleteTransferTemplate({
          tenantId: testTenant.id,
          templateId: 'non-existent-id',
          userId: user.id,
        })
      ).rejects.toThrow('Template not found');
    });

    it('should reject if template is already archived', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      // Archive once
      await templateService.deleteTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
        userId: user.id,
      });

      // Try to archive again
      await expect(
        templateService.deleteTransferTemplate({
          tenantId: testTenant.id,
          templateId: created.id,
          userId: user.id,
        })
      ).rejects.toThrow('Template is already archived');
    });
  });

  describe('[AC-010-6] duplicateTransferTemplate', () => {
    it('should duplicate template with new name', async () => {
      const original = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Original Template',
          description: 'Original description',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, defaultQty: 100 },
            { productId: product2.id, defaultQty: 50 },
          ],
        },
      });

      const duplicate = await templateService.duplicateTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        templateId: original.id,
        newName: 'Duplicated Template',
      });

      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.name).toBe('Duplicated Template');
      expect(duplicate.description).toBe(original.description);
      expect(duplicate.sourceBranchId).toBe(original.sourceBranchId);
      expect(duplicate.destinationBranchId).toBe(original.destinationBranchId);
      expect(duplicate.items).toHaveLength(2);
      expect(duplicate.items[0]?.productId).toBe(product1.id);
      expect(duplicate.items[0]?.defaultQty).toBe(100);
      expect(duplicate.items[1]?.productId).toBe(product2.id);
      expect(duplicate.items[1]?.defaultQty).toBe(50);
    });

    it('should generate default name if not provided', async () => {
      const original = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Original Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const duplicate = await templateService.duplicateTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        templateId: original.id,
      });

      expect(duplicate.name).toBe('Original Template (Copy)');
    });

    it('should reject if original template does not exist', async () => {
      await expect(
        templateService.duplicateTransferTemplate({
          tenantId: testTenant.id,
          userId: user.id,
          templateId: 'non-existent-id',
        })
      ).rejects.toThrow('Template not found');
    });
  });

  describe('[AC-010-7] restoreTransferTemplate', () => {
    it('should restore archived template', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Template to Restore',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      // Archive the template
      await templateService.deleteTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
        userId: user.id,
      });

      // Restore the template
      const restored = await templateService.restoreTransferTemplate({
        tenantId: testTenant.id,
        templateId: created.id,
      });

      expect(restored.isArchived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.archivedByUserId).toBeNull();
    });

    it('should reject if template does not exist', async () => {
      await expect(
        templateService.restoreTransferTemplate({
          tenantId: testTenant.id,
          templateId: 'non-existent-id',
        })
      ).rejects.toThrow('Template not found');
    });

    it('should reject if template is not archived', async () => {
      const created = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Active Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      await expect(
        templateService.restoreTransferTemplate({
          tenantId: testTenant.id,
          templateId: created.id,
        })
      ).rejects.toThrow('Template is not archived');
    });
  });

  describe('[AC-010-8] Archival Filtering', () => {
    beforeEach(async () => {
      // Create 3 templates: 2 active, 1 archived
      const template1 = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Active Template 1',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      const template2 = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Active Template 2',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 20 }],
        },
      });

      const template3 = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Archived Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 30 }],
        },
      });

      // Archive template3
      await templateService.deleteTransferTemplate({
        tenantId: testTenant.id,
        templateId: template3.id,
        userId: user.id,
      });
    });

    it('should exclude archived templates by default (active-only)', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((t) => !t.isArchived)).toBe(true);
      expect(result.items.some((t) => t.name === 'Archived Template')).toBe(false);
    });

    it('should show only archived templates with archivedFilter=archived-only', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { archivedFilter: 'archived-only' },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.isArchived).toBe(true);
      expect(result.items[0]?.name).toBe('Archived Template');
    });

    it('should show all templates with archivedFilter=all', async () => {
      const result = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { archivedFilter: 'all' },
      });

      expect(result.items).toHaveLength(3);
      const archivedCount = result.items.filter((t) => t.isArchived).length;
      const activeCount = result.items.filter((t) => !t.isArchived).length;
      expect(archivedCount).toBe(1);
      expect(activeCount).toBe(2);
    });

    it('should allow getTemplate to retrieve archived templates', async () => {
      // Find the archived template
      const archivedList = await templateService.listTransferTemplates({
        tenantId: testTenant.id,
        filters: { archivedFilter: 'archived-only' },
      });

      const archivedTemplate = archivedList.items[0];
      expect(archivedTemplate).toBeDefined();

      // Should be able to get the archived template by ID
      const retrieved = await templateService.getTransferTemplate({
        tenantId: testTenant.id,
        templateId: archivedTemplate!.id,
      });

      expect(retrieved.id).toBe(archivedTemplate!.id);
      expect(retrieved.isArchived).toBe(true);
      expect(retrieved.name).toBe('Archived Template');
    });
  });

  describe('[AC-010-9] Multi-tenant Isolation for Archival', () => {
    it('should not allow archiving another tenant\'s template', async () => {
      // Create template for tenant1
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Tenant1 Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      // Create second tenant
      const tenant2 = await createTestTenant();

      // Try to archive with wrong tenant ID
      await expect(
        templateService.deleteTransferTemplate({
          tenantId: tenant2.id,
          templateId: template.id,
          userId: user.id,
        })
      ).rejects.toThrow('Template not found');
    });

    it('should not allow restoring another tenant\'s template', async () => {
      // Create and archive template for tenant1
      const template = await templateService.createTransferTemplate({
        tenantId: testTenant.id,
        userId: user.id,
        data: {
          name: 'Tenant1 Template',
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, defaultQty: 10 }],
        },
      });

      await templateService.deleteTransferTemplate({
        tenantId: testTenant.id,
        templateId: template.id,
        userId: user.id,
      });

      // Create second tenant
      const tenant2 = await createTestTenant();

      // Try to restore with wrong tenant ID
      await expect(
        templateService.restoreTransferTemplate({
          tenantId: tenant2.id,
          templateId: template.id,
        })
      ).rejects.toThrow('Template not found');
    });
  });
});
