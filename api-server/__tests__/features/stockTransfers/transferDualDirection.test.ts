// api-server/__tests__/features/stockTransfers/transferDualDirection.test.ts
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
  createTestProduct,
} from '../../helpers/factories.js';
import { createStockTransfer, reviewStockTransfer, listStockTransfers } from '../../../src/services/stockTransfers/stockTransferService.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

describe('[TRANSFER-DUAL-DIRECTION] Stock Transfer Dual-Direction Initiation', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let role: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  // Branches
  let warehouse: Awaited<ReturnType<typeof createTestBranch>>;
  let retailStore: Awaited<ReturnType<typeof createTestBranch>>;

  // Products
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create test tenant and user
    testTenant = await createTestTenant();
    testUser = await createTestUser();

    // Create role with stock permissions
    role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    await createTestMembership({
      userId: testUser.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Create branches
    warehouse = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Main Warehouse',
    });

    retailStore = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Retail Store',
    });

    // Create products
    product1 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Product A',
      sku: 'SKU-A',
      pricePence: 1000,
    });

    product2 = await createTestProduct({
      tenantId: testTenant.id,
      name: 'Product B',
      sku: 'SKU-B',
      pricePence: 2000,
    });
  });

  describe('PUSH Workflow (Source Initiates)', () => {
    it('should create PUSH transfer when user is in source branch', async () => {
      // User is member of warehouse (source branch)
      await addUserToBranch(testUser.id, testTenant.id, warehouse.id);

      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [
            { productId: product1.id, qtyRequested: 10 },
            { productId: product2.id, qtyRequested: 5 },
          ],
        },
      });

      expect(transfer).toBeDefined();
      expect(transfer.initiationType).toBe('PUSH');
      expect(transfer.initiatedByBranchId).toBe(warehouse.id);
      expect(transfer.sourceBranchId).toBe(warehouse.id);
      expect(transfer.destinationBranchId).toBe(retailStore.id);
      expect(transfer.status).toBe('REQUESTED');
    });

    it('should default to PUSH when initiationType not specified (backward compatibility)', async () => {
      // User is member of warehouse (source branch)
      await addUserToBranch(testUser.id, testTenant.id, warehouse.id);

      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          // initiationType not specified
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      expect(transfer.initiationType).toBe('PUSH');
      expect(transfer.initiatedByBranchId).toBe(warehouse.id);
    });

    it('should reject PUSH transfer when user is not in source branch', async () => {
      // User is member of retail store (destination), NOT source
      await addUserToBranch(testUser.id, testTenant.id, retailStore.id);

      await expect(
        createStockTransfer({
          tenantId: testTenant.id,
          userId: testUser.id,
          data: {
            sourceBranchId: warehouse.id,
            destinationBranchId: retailStore.id,
            initiationType: 'PUSH',
            items: [{ productId: product1.id, qtyRequested: 10 }],
          },
        })
      ).rejects.toThrow();
    });

    it('should allow destination branch to review PUSH transfer', async () => {
      // Create user in warehouse (source)
      const warehouseUser = await createTestUser();
      await createTestMembership({
        userId: warehouseUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(warehouseUser.id, testTenant.id, warehouse.id);

      // Create transfer from warehouse
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: warehouseUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Retail store user (destination) should be able to review
      const retailUser = await createTestUser();
      await createTestMembership({
        userId: retailUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(retailUser.id, testTenant.id, retailStore.id);

      const reviewed = await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: retailUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      expect(reviewed.status).toBe('APPROVED');
    });

    it('should reject review from source branch for PUSH transfer', async () => {
      // Create user in warehouse (source)
      const warehouseUser = await createTestUser();
      await createTestMembership({
        userId: warehouseUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(warehouseUser.id, testTenant.id, warehouse.id);

      // Create transfer from warehouse
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: warehouseUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Source user should NOT be able to review their own PUSH transfer
      await expect(
        reviewStockTransfer({
          tenantId: testTenant.id,
          userId: warehouseUser.id,
          transferId: transfer.id,
          action: 'approve',
        })
      ).rejects.toThrow();
    });
  });

  describe('PULL Workflow (Destination Initiates)', () => {
    it('should create PULL transfer when user is in destination branch', async () => {
      // User is member of retail store (destination branch)
      await addUserToBranch(testUser.id, testTenant.id, retailStore.id);

      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PULL',
          items: [
            { productId: product1.id, qtyRequested: 10 },
            { productId: product2.id, qtyRequested: 5 },
          ],
        },
      });

      expect(transfer).toBeDefined();
      expect(transfer.initiationType).toBe('PULL');
      expect(transfer.initiatedByBranchId).toBe(retailStore.id);
      expect(transfer.sourceBranchId).toBe(warehouse.id);
      expect(transfer.destinationBranchId).toBe(retailStore.id);
      expect(transfer.status).toBe('REQUESTED');
    });

    it('should reject PULL transfer when user is not in destination branch', async () => {
      // User is member of warehouse (source), NOT destination
      await addUserToBranch(testUser.id, testTenant.id, warehouse.id);

      await expect(
        createStockTransfer({
          tenantId: testTenant.id,
          userId: testUser.id,
          data: {
            sourceBranchId: warehouse.id,
            destinationBranchId: retailStore.id,
            initiationType: 'PULL',
            items: [{ productId: product1.id, qtyRequested: 10 }],
          },
        })
      ).rejects.toThrow();
    });

    it('should allow source branch to review PULL transfer', async () => {
      // Create user in retail store (destination)
      const retailUser = await createTestUser();
      await createTestMembership({
        userId: retailUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(retailUser.id, testTenant.id, retailStore.id);

      // Create PULL transfer from retail store (requesting from warehouse)
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: retailUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PULL',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Warehouse user (source) should be able to review
      const warehouseUser = await createTestUser();
      await createTestMembership({
        userId: warehouseUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(warehouseUser.id, testTenant.id, warehouse.id);

      const reviewed = await reviewStockTransfer({
        tenantId: testTenant.id,
        userId: warehouseUser.id,
        transferId: transfer.id,
        action: 'approve',
      });

      expect(reviewed.status).toBe('APPROVED');
    });

    it('should reject review from destination branch for PULL transfer', async () => {
      // Create user in retail store (destination)
      const retailUser = await createTestUser();
      await createTestMembership({
        userId: retailUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(retailUser.id, testTenant.id, retailStore.id);

      // Create PULL transfer from retail store
      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: retailUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PULL',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Destination user should NOT be able to review their own PULL transfer
      await expect(
        reviewStockTransfer({
          tenantId: testTenant.id,
          userId: retailUser.id,
          transferId: transfer.id,
          action: 'approve',
        })
      ).rejects.toThrow();
    });
  });

  describe('Filtering by Initiation Type', () => {
    beforeEach(async () => {
      // Add user to both branches for setup
      await addUserToBranch(testUser.id, testTenant.id, warehouse.id);
      await addUserToBranch(testUser.id, testTenant.id, retailStore.id);
    });

    it('should filter transfers by PUSH initiation type', async () => {
      // Create PUSH transfer
      const pushTransfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Create PULL transfer
      const pullTransfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PULL',
          items: [{ productId: product2.id, qtyRequested: 5 }],
        },
      });

      // Filter by PUSH
      const result = await listStockTransfers({
        tenantId: testTenant.id,
        userId: testUser.id,
        filters: {
          initiationType: 'PUSH',
        },
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const foundPush = result.items.find(t => t.id === pushTransfer.id);
      const foundPull = result.items.find(t => t.id === pullTransfer.id);

      expect(foundPush).toBeDefined();
      expect(foundPull).toBeUndefined();
    });

    it('should filter transfers by PULL initiation type', async () => {
      // Create PUSH transfer
      const pushTransfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Create PULL transfer
      const pullTransfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PULL',
          items: [{ productId: product2.id, qtyRequested: 5 }],
        },
      });

      // Filter by PULL
      const result = await listStockTransfers({
        tenantId: testTenant.id,
        userId: testUser.id,
        filters: {
          initiationType: 'PULL',
        },
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const foundPush = result.items.find(t => t.id === pushTransfer.id);
      const foundPull = result.items.find(t => t.id === pullTransfer.id);

      expect(foundPush).toBeUndefined();
      expect(foundPull).toBeDefined();
    });

    it('should filter transfers initiated by user\'s branches', async () => {
      // Create a third branch that testUser is NOT a member of
      const storeBranch = await createTestBranch({
        tenantId: testTenant.id,
        name: 'Store Branch',
      });

      // testUser initiates from warehouse (PUSH) - they ARE in warehouse
      const userInitiated = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Create another user in storeBranch (which testUser is NOT in)
      const otherUser = await createTestUser();
      await createTestMembership({
        userId: otherUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });
      await addUserToBranch(otherUser.id, testTenant.id, storeBranch.id);

      // otherUser creates PULL from storeBranch (testUser NOT in this branch)
      const otherInitiated = await createStockTransfer({
        tenantId: testTenant.id,
        userId: otherUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: storeBranch.id,
          initiationType: 'PULL',
          items: [{ productId: product2.id, qtyRequested: 5 }],
        },
      });

      // Filter by initiatedByMe for testUser
      const result = await listStockTransfers({
        tenantId: testTenant.id,
        userId: testUser.id,
        filters: {
          initiatedByMe: true,
        },
      });

      const foundUserInitiated = result.items.find(t => t.id === userInitiated.id);
      const foundOtherInitiated = result.items.find(t => t.id === otherInitiated.id);

      // testUser's transfer should be found (initiated from warehouse, which they're in)
      expect(foundUserInitiated).toBeDefined();
      // otherUser's transfer should NOT be found (initiated from storeBranch, which testUser is NOT in)
      expect(foundOtherInitiated).toBeUndefined();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow access to transfers from different tenant', async () => {
      // Create transfer in first tenant
      await addUserToBranch(testUser.id, testTenant.id, warehouse.id);

      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      // Create second tenant with own branches
      const tenant2 = await createTestTenant();
      const warehouse2 = await createTestBranch({
        tenantId: tenant2.id,
        name: 'Tenant 2 Warehouse',
      });

      const user2 = await createTestUser();
      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });
      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });
      await addUserToBranch(user2.id, tenant2.id, warehouse2.id);

      // User from tenant2 should NOT see tenant1's transfer
      const result = await listStockTransfers({
        tenantId: tenant2.id,
        userId: user2.id,
      });

      const foundTransfer = result.items.find(t => t.id === transfer.id);
      expect(foundTransfer).toBeUndefined();
    });
  });

  describe('Audit Trail', () => {
    it('should create audit log for PUSH transfer creation', async () => {
      await addUserToBranch(testUser.id, testTenant.id, warehouse.id);

      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PUSH',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: transfer.id,
          entityType: 'STOCK_TRANSFER',
          action: 'TRANSFER_REQUEST',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should create audit log for PULL transfer creation', async () => {
      await addUserToBranch(testUser.id, testTenant.id, retailStore.id);

      const transfer = await createStockTransfer({
        tenantId: testTenant.id,
        userId: testUser.id,
        data: {
          sourceBranchId: warehouse.id,
          destinationBranchId: retailStore.id,
          initiationType: 'PULL',
          items: [{ productId: product1.id, qtyRequested: 10 }],
        },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: transfer.id,
          entityType: 'STOCK_TRANSFER',
          action: 'TRANSFER_REQUEST',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });
  });
});
