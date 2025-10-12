// api-server/__tests__/services/product.test.ts
import {
  getProductForCurrentTenantService,
  listProductsForCurrentTenantService,
  createProductForCurrentTenantService,
  updateProductForCurrentTenantService,
  deleteProductForCurrentTenantService,
} from '../../src/services/products/productService.js';
import { cleanDatabase } from '../helpers/db.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
} from '../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

describe('[ST-007] Product Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeEach(async () => {
    await cleanDatabase();
    testTenant = await createTestTenant({ slug: 'product-test-tenant' });
    testUser = await createTestUser({ email: 'product@test.com' });
  });

  describe('[AC-007-1] createProductForCurrentTenantService - Create Product', () => {
    it('should create a product with valid data', async () => {
      const result = await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'Test Widget',
        productSkuInputValue: 'WIDGET-001',
        productPricePenceInputValue: 1500,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result).toBeDefined();
      expect(result.productName).toBe('Test Widget');
      expect(result.productSku).toBe('WIDGET-001');
      expect(result.productPricePence).toBe(1500);
      expect(result.entityVersion).toBe(1);
      expect(result.tenantId).toBe(testTenant.id);
    });

    it('should create audit log entry', async () => {
      const result = await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'Audited Product',
        productSkuInputValue: 'AUDIT-001',
        productPricePenceInputValue: 2000,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: result.id,
          action: 'CREATE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.entityType).toBe('PRODUCT');
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should reject duplicate SKU in same tenant', async () => {
      await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'First Product',
        productSkuInputValue: 'DUPE-001',
        productPricePenceInputValue: 1000,
      });

      await expect(
        createProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productNameInputValue: 'Second Product',
          productSkuInputValue: 'DUPE-001', // Duplicate SKU
          productPricePenceInputValue: 2000,
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same SKU in different tenants', async () => {
      const tenant2 = await createTestTenant({ slug: 'other-tenant' });

      await createProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productNameInputValue: 'Product Tenant 1',
        productSkuInputValue: 'SHARED-SKU',
        productPricePenceInputValue: 1000,
      });

      const result2 = await createProductForCurrentTenantService({
        currentTenantId: tenant2.id,
        productNameInputValue: 'Product Tenant 2',
        productSkuInputValue: 'SHARED-SKU', // Same SKU, different tenant
        productPricePenceInputValue: 2000,
      });

      expect(result2).toBeDefined();
      expect(result2.productSku).toBe('SHARED-SKU');
      expect(result2.tenantId).toBe(tenant2.id);
    });
  });

  describe('[AC-007-2] getProductForCurrentTenantService - Get Product', () => {
    it('should retrieve product by ID', async () => {
      const created = await createTestProduct({
        name: 'Get Test Product',
        sku: 'GET-001',
        tenantId: testTenant.id,
        pricePence: 1500,
      });

      const result = await getProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.productName).toBe('Get Test Product');
      expect(result.productSku).toBe('GET-001');
    });

    it('should throw not found for non-existent product', async () => {
      await expect(
        getProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: 'non-existent-id',
        })
      ).rejects.toThrow('not found');
    });

    it('should not allow access to product from different tenant', async () => {
      const tenant2 = await createTestTenant({ slug: 'other-tenant-2' });
      const otherProduct = await createTestProduct({
        name: 'Other Product',
        sku: 'OTHER-001',
        tenantId: tenant2.id,
      });

      await expect(
        getProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: otherProduct.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('[AC-007-3] updateProductForCurrentTenantService - Update Product', () => {
    it('should update product with correct entityVersion', async () => {
      const created = await createTestProduct({
        name: 'Original Name',
        sku: 'UPDATE-001',
        tenantId: testTenant.id,
        pricePence: 1000,
      });

      expect(created.entityVersion).toBe(1);

      const updated = await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productNameInputValue: 'Updated Name',
        productPricePenceInputValue: 1500,
        currentEntityVersionInputValue: 1,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(updated.productName).toBe('Updated Name');
      expect(updated.productPricePence).toBe(1500);
      expect(updated.entityVersion).toBe(2); // Incremented
    });

    it('should reject update with stale entityVersion (optimistic locking)', async () => {
      const created = await createTestProduct({
        name: 'Original',
        sku: 'LOCK-001',
        tenantId: testTenant.id,
      });

      // First update
      await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productNameInputValue: 'First Update',
        currentEntityVersionInputValue: 1,
      });

      // Second update with stale version
      await expect(
        updateProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: created.id,
          productNameInputValue: 'Second Update',
          currentEntityVersionInputValue: 1, // Stale version
        })
      ).rejects.toThrow('modified by someone else');
    });

    it('should increment entityVersion on each update', async () => {
      const created = await createTestProduct({
        name: 'Version Test',
        sku: 'VERSION-001',
        tenantId: testTenant.id,
      });

      expect(created.entityVersion).toBe(1);

      const update1 = await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productNameInputValue: 'Update 1',
        currentEntityVersionInputValue: 1,
      });
      expect(update1.entityVersion).toBe(2);

      const update2 = await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productNameInputValue: 'Update 2',
        currentEntityVersionInputValue: 2,
      });
      expect(update2.entityVersion).toBe(3);

      const update3 = await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productNameInputValue: 'Update 3',
        currentEntityVersionInputValue: 3,
      });
      expect(update3.entityVersion).toBe(4);
    });

    it('should create audit log entry on update', async () => {
      const created = await createTestProduct({
        name: 'Audit Update Test',
        sku: 'AUDIT-UPDATE-001',
        tenantId: testTenant.id,
        pricePence: 1000,
      });

      await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productPricePenceInputValue: 2000,
        currentEntityVersionInputValue: 1,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: created.id,
          action: 'UPDATE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.entityType).toBe('PRODUCT');
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should not allow update of product from different tenant', async () => {
      const tenant2 = await createTestTenant({ slug: 'update-tenant-2' });
      const otherProduct = await createTestProduct({
        name: 'Other Product',
        sku: 'OTHER-UPDATE-001',
        tenantId: tenant2.id,
      });

      await expect(
        updateProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: otherProduct.id,
          productNameInputValue: 'Hacked Name',
          currentEntityVersionInputValue: 1,
        })
      ).rejects.toThrow('not found');
    });

    it('should allow partial updates', async () => {
      const created = await createTestProduct({
        name: 'Original Name',
        sku: 'PARTIAL-001',
        tenantId: testTenant.id,
        pricePence: 1000,
      });

      // Update only name
      const updated1 = await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productNameInputValue: 'New Name',
        currentEntityVersionInputValue: 1,
      });
      expect(updated1.productName).toBe('New Name');
      expect(updated1.productPricePence).toBe(1000); // Unchanged

      // Update only price
      const updated2 = await updateProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        productPricePenceInputValue: 2000,
        currentEntityVersionInputValue: 2,
      });
      expect(updated2.productName).toBe('New Name'); // Still same
      expect(updated2.productPricePence).toBe(2000);
    });
  });

  describe('[AC-007-4] deleteProductForCurrentTenantService - Delete Product', () => {
    it('should delete product', async () => {
      const created = await createTestProduct({
        name: 'To Delete',
        sku: 'DELETE-001',
        tenantId: testTenant.id,
      });

      const result = await deleteProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.hasDeletedProduct).toBe(true);

      // Verify product is gone
      const found = await prisma.product.findFirst({
        where: { id: created.id },
      });
      expect(found).toBeNull();
    });

    it('should create audit log entry on delete', async () => {
      const created = await createTestProduct({
        name: 'Audit Delete Test',
        sku: 'AUDIT-DELETE-001',
        tenantId: testTenant.id,
      });

      await deleteProductForCurrentTenantService({
        currentTenantId: testTenant.id,
        productIdPathParam: created.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: created.id,
          action: 'DELETE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.entityType).toBe('PRODUCT');
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should throw not found for non-existent product', async () => {
      await expect(
        deleteProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: 'non-existent-id',
        })
      ).rejects.toThrow('not found');
    });

    it('should not allow delete of product from different tenant', async () => {
      const tenant2 = await createTestTenant({ slug: 'delete-tenant-2' });
      const otherProduct = await createTestProduct({
        name: 'Other Product',
        sku: 'OTHER-DELETE-001',
        tenantId: tenant2.id,
      });

      await expect(
        deleteProductForCurrentTenantService({
          currentTenantId: testTenant.id,
          productIdPathParam: otherProduct.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('[AC-007-5] listProductsForCurrentTenantService - List Products', () => {
    beforeEach(async () => {
      // Create test products
      await createTestProduct({
        name: 'Widget A',
        sku: 'WIDGET-A',
        tenantId: testTenant.id,
        pricePence: 1000,
      });
      await createTestProduct({
        name: 'Widget B',
        sku: 'WIDGET-B',
        tenantId: testTenant.id,
        pricePence: 2000,
      });
      await createTestProduct({
        name: 'Gadget C',
        sku: 'GADGET-C',
        tenantId: testTenant.id,
        pricePence: 1500,
      });
    });

    it('should list all products for tenant', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      expect(result.items).toHaveLength(3);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should respect limit parameter', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        limitOptional: 2,
      });

      expect(result.items).toHaveLength(2);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.nextCursor).toBeDefined();
    });

    it('should support cursor pagination', async () => {
      const page1 = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        limitOptional: 2,
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.pageInfo.hasNextPage).toBe(true);

      const page2 = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        limitOptional: 2,
        cursorIdOptional: page1.pageInfo.nextCursor!,
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.pageInfo.hasNextPage).toBe(false);
    });

    it('should filter by search query', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        qOptional: 'Widget',
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((p) => p.productName.includes('Widget'))).toBe(true);
    });

    it('should filter by price range', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        minPricePenceOptional: 1500,
        maxPricePenceOptional: 2000,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every((p) => p.productPricePence >= 1500 && p.productPricePence <= 2000)).toBe(true);
    });

    it('should sort by name ascending', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        sortByOptional: 'productName',
        sortDirOptional: 'asc',
      });

      expect(result.items[0]?.productName).toBe('Gadget C');
      expect(result.items[1]?.productName).toBe('Widget A');
      expect(result.items[2]?.productName).toBe('Widget B');
    });

    it('should sort by price descending', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        sortByOptional: 'productPricePence',
        sortDirOptional: 'desc',
      });

      expect(result.items[0]?.productPricePence).toBe(2000);
      expect(result.items[1]?.productPricePence).toBe(1500);
      expect(result.items[2]?.productPricePence).toBe(1000);
    });

    it('should include total count when requested', async () => {
      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
        includeTotalOptional: true,
      });

      expect(result.pageInfo.totalCount).toBe(3);
    });

    it('should only return products for current tenant', async () => {
      const tenant2 = await createTestTenant({ slug: 'list-tenant-2' });
      await createTestProduct({
        name: 'Other Tenant Product',
        sku: 'OTHER-001',
        tenantId: tenant2.id,
      });

      const result = await listProductsForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      expect(result.items).toHaveLength(3);
      expect(result.items.every((p) => p.tenantId === testTenant.id)).toBe(true);
    });
  });

  describe('[AC-007-6] Multi-Tenant Isolation', () => {
    it('should completely isolate products between tenants', async () => {
      const tenant1 = await createTestTenant({ slug: 'tenant-1' });
      const tenant2 = await createTestTenant({ slug: 'tenant-2' });

      // Create products in each tenant
      const product1 = await createTestProduct({
        name: 'Tenant 1 Product',
        sku: 'T1-001',
        tenantId: tenant1.id,
      });

      const product2 = await createTestProduct({
        name: 'Tenant 2 Product',
        sku: 'T2-001',
        tenantId: tenant2.id,
      });

      // Tenant 1 can only see their product
      const list1 = await listProductsForCurrentTenantService({
        currentTenantId: tenant1.id,
      });
      expect(list1.items).toHaveLength(1);
      expect(list1.items[0]?.id).toBe(product1.id);

      // Tenant 2 can only see their product
      const list2 = await listProductsForCurrentTenantService({
        currentTenantId: tenant2.id,
      });
      expect(list2.items).toHaveLength(1);
      expect(list2.items[0]?.id).toBe(product2.id);

      // Tenant 1 cannot get tenant 2's product
      await expect(
        getProductForCurrentTenantService({
          currentTenantId: tenant1.id,
          productIdPathParam: product2.id,
        })
      ).rejects.toThrow('not found');

      // Tenant 2 cannot get tenant 1's product
      await expect(
        getProductForCurrentTenantService({
          currentTenantId: tenant2.id,
          productIdPathParam: product1.id,
        })
      ).rejects.toThrow('not found');
    });
  });
});
