// api-server/__tests__/services/chat/productTools.test.ts
import { productTools } from '../../../../src/services/chat/tools/productTools.js';
import { receiveStock } from '../../../../src/services/stockService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../../helpers/factories.js';

const TOOL_CALL_OPTIONS = { toolCallId: 'test', messages: [] as any[] };

describe('[CHAT-PRODUCT-001] AI Chat Product Tools', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create tenant and user
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create branch
    testBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create role and membership
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['products:read', 'stock:read'],
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    await addUserToBranch(testUser.id, testTenant.id, testBranch.id);

    // Create products
    product1 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Alpha',
      sku: 'WID-001',
      pricePence: 1500, // £15.00
      barcode: '1234567890',
    });

    product2 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Widget Beta',
      sku: 'WID-002',
      pricePence: 2000, // £20.00
      barcode: '0987654321',
    });
  });

  describe('[AC-PRODUCT-001] searchProducts', () => {
    it('should search products by name', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'Widget',
        limit: 10,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.count).toBeGreaterThanOrEqual(2);
      expect(result.products?.some((p) => p.name === 'Widget Alpha')).toBe(true);
      expect(result.products?.some((p) => p.name === 'Widget Beta')).toBe(true);
    });

    it('should search products by SKU', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'WID-001',
        limit: 10,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.products?.[0]?.sku).toBe('WID-001');
    });

    it('should format prices correctly', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'Widget Alpha',
        limit: 10,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      const product = result.products?.find((p) => p.name === 'Widget Alpha');
      expect(product?.price).toBe('£15.00');
    });

    it('should respect limit parameter', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'Widget',
        limit: 1,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.products?.length).toBeLessThanOrEqual(1);
    });

    it('should cap limit at 10', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'Widget',
        limit: 50, // Request 50, should cap at 10
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.products?.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no products found', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'NonExistentProduct12345',
        limit: 10,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.count).toBe(0);
      expect(result.products).toEqual([]);
      expect(result.message).toContain('No products found');
    });

    it('should not show products from other tenants', async () => {
      // Create another tenant with a product
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
        name: 'Other Tenant Product',
        sku: 'OTHER-001',
      });

      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchProducts.execute!({
        query: 'Other Tenant',  
        limit: 10,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.products?.some((p) => p.id === otherProduct.id)).toBe(false);
    });
  });

  describe('[AC-PRODUCT-002] getProductDetails', () => {
    it('should get product details by ID', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getProductDetails.execute!({
        productId: product1.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.id).toBe(product1.id);
      expect(result.name).toBe('Widget Alpha');
      expect(result.sku).toBe('WID-001');
      expect(result.price).toBe('£15.00');
      expect(result.barcode).toBe('1234567890');
    });

    it('should get product details by SKU', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getProductDetails.execute!({
        sku: 'WID-002',
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.id).toBe(product2.id);
      expect(result.name).toBe('Widget Beta');
      expect(result.sku).toBe('WID-002');
      expect(result.price).toBe('£20.00');
    });

    it('should return error if product not found', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getProductDetails.execute!({
        productId: 'non-existent-id',
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.error).toBe('Unable to get product details');
    });

    it('should return error if neither ID nor SKU provided', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getProductDetails.execute!({
        productId: 'non-existent-id',
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.error).toBe('Unable to get product details');
    });
  });

  describe('[AC-PRODUCT-003] getStockLevel', () => {
    beforeEach(async () => {
      // Add stock to branch
      await receiveStock(
        { currentTenantId: testTenant.id, currentUserId: testUser.id },
        {
          branchId: testBranch.id,
          productId: product1.id,
          qty: 1000,
          unitCostPence: 1200,
        }
      );
    });

    it('should get stock level by product ID and branch ID', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        productId: product1.id,
        branchId: testBranch.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');  
      }

      expect(result.product).toBe('Widget Alpha');
      expect(result.sku).toBe('WID-001');
      expect(result.qtyOnHand).toBe(1000);
      expect(result.qtyAllocated).toBe(0);
      expect(result.qtyAvailable).toBe(1000);
    });

    it('should get stock level by SKU and branch name', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        sku: 'WID-001',
        branchName: testBranch.branchName,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.product).toBe('Widget Alpha');
      expect(result.qtyOnHand).toBe(1000);
    });

    it('should default to user first branch membership if no branch specified', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        productId: product1.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.product).toBe('Widget Alpha');
      expect(result.branch).toBe(testBranch.branchName);
    });

    it('should return zero quantities for product with no stock', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        productId: product2.id, // No stock received for product2
        branchId: testBranch.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.qtyOnHand).toBe(0);
      expect(result.qtyAllocated).toBe(0);
      expect(result.qtyAvailable).toBe(0);
    });

    it('should return error if product not found', async () => {
      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        productId: 'non-existent-id',
        branchId: testBranch.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.error).toBe('Unable to get stock level');
    });

    it('should return error if user has no branch memberships', async () => {
      // Create user with no branch memberships
      const userWithoutBranches = await createTestUser();
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'stock:read'],
      });
      await createTestMembership({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const tools = productTools({
        userId: userWithoutBranches.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        productId: product1.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.error).toBe('No branch specified');
      expect(result.message).toContain('must specify a branch');
    });
  });

  describe('[AC-PRODUCT-004] Security - Tenant Isolation', () => {
    it('should not access products from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherProduct = await createTestProduct({
        tenantId: otherTenant.id,
        name: 'Other Tenant Product',
      });

      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getProductDetails.execute!({
        productId: otherProduct.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.error).toBe('Unable to get product details');
    });

    it('should not access stock from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherBranch = await createTestBranch({
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
      await addUserToBranch(otherUser.id, otherTenant.id, otherBranch.id);

      await receiveStock(
        { currentTenantId: otherTenant.id, currentUserId: otherUser.id },
        {
          branchId: otherBranch.id,
          productId: otherProduct.id,
          qty: 500,
          unitCostPence: 1000,
        }
      );

      const tools = productTools({
        userId: testUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getStockLevel.execute!({
        productId: otherProduct.id,
        branchId: otherBranch.id,
      }, TOOL_CALL_OPTIONS);

      if (Symbol.asyncIterator in result) {
        throw new Error('Unexpected AsyncIterable');
      }

      expect(result.error).toBeDefined();
    });
  });
});
