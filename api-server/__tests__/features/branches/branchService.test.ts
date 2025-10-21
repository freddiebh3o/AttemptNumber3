// api-server/__tests__/features/branches/branchService.test.ts
import {
  createBranchForCurrentTenantService,
  listBranchesForCurrentTenantService,
  getBranchForCurrentTenantService,
  updateBranchForCurrentTenantService,
  archiveBranchForCurrentTenantService,
  restoreBranchForCurrentTenantService,
} from '../../../src/services/branches/branchService.js';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

describe('[BRANCH-SVC] Branch Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
  });

  describe('createBranchForCurrentTenantService - Create Branch', () => {
    it('should create a branch with valid data', async () => {
      const result = await createBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchSlugInputValue: 'warehouse-1',
        branchNameInputValue: 'Main Warehouse',
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result).toBeDefined();
      expect(result.branchSlug).toBe('warehouse-1');
      expect(result.branchName).toBe('Main Warehouse');
      expect(result.tenantId).toBe(testTenant.id);
      expect(result.isActive).toBe(true);
    });

    it('should create branch as inactive when specified', async () => {
      const result = await createBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchSlugInputValue: 'inactive-warehouse',
        branchNameInputValue: 'Inactive Warehouse',
        isActiveInputValue: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('should create audit log entry', async () => {
      const result = await createBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchSlugInputValue: 'audited-branch',
        branchNameInputValue: 'Audited Branch',
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: result.id,
          action: 'CREATE',
          entityType: 'BRANCH',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
      expect(auditEntry?.tenantId).toBe(testTenant.id);
    });

    it('should reject duplicate slug in same tenant', async () => {
      await createBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchSlugInputValue: 'duplicate-slug',
        branchNameInputValue: 'First Branch',
      });

      await expect(
        createBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchSlugInputValue: 'duplicate-slug',
          branchNameInputValue: 'Second Branch',
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same slug in different tenants', async () => {
      const tenant2 = await createTestTenant();

      await createBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchSlugInputValue: 'shared-slug',
        branchNameInputValue: 'Branch Tenant 1',
      });

      const result2 = await createBranchForCurrentTenantService({
        currentTenantId: tenant2.id,
        branchSlugInputValue: 'shared-slug',
        branchNameInputValue: 'Branch Tenant 2',
      });

      expect(result2).toBeDefined();
      expect(result2.branchSlug).toBe('shared-slug');
      expect(result2.tenantId).toBe(tenant2.id);
    });
  });

  describe('listBranchesForCurrentTenantService - List Branches', () => {
    it('should list branches for tenant', async () => {
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch 1' });
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch 2' });

      const result = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.items.every((b) => b.tenantId === testTenant.id)).toBe(true);
    });

    it('should support pagination with limit', async () => {
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch A' });
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch B' });
      await createTestBranch({ tenantId: testTenant.id, name: 'Branch C' });

      const result = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
        limitOptional: 2,
      });

      expect(result.items.length).toBe(2);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.nextCursor).toBeDefined();
    });

    it('should filter by search query', async () => {
      await createTestBranch({
        tenantId: testTenant.id,
        name: 'Warehouse Alpha',
        slug: 'warehouse-alpha',
      });
      await createTestBranch({ tenantId: testTenant.id, name: 'Store Beta' });

      const result = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
        qOptional: 'warehouse',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.some((b) => b.branchName.toLowerCase().includes('warehouse'))).toBe(true);
    });

    it('should filter by isActive', async () => {
      await createTestBranch({ tenantId: testTenant.id, isActive: true });
      await createTestBranch({ tenantId: testTenant.id, isActive: false });

      const activeResult = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
        isActiveOptional: true,
      });

      expect(activeResult.items.every((b) => b.isActive === true)).toBe(true);
    });

    it('should filter archived branches', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });
      await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      const activeOnly = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
        archivedFilterOptional: 'active-only',
      });

      expect(activeOnly.items.every((b) => !b.isArchived)).toBe(true);

      const archivedOnly = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
        archivedFilterOptional: 'archived-only',
      });

      expect(archivedOnly.items.every((b) => b.isArchived)).toBe(true);
    });

    it('should not return branches from other tenants', async () => {
      const tenant2 = await createTestTenant();
      await createTestBranch({ tenantId: tenant2.id });

      const result = await listBranchesForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      expect(result.items.every((b) => b.tenantId === testTenant.id)).toBe(true);
    });
  });

  describe('getBranchForCurrentTenantService - Get Branch by ID', () => {
    it('should retrieve branch by ID', async () => {
      const branch = await createTestBranch({
        tenantId: testTenant.id,
        name: 'Test Branch',
      });

      const result = await getBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchId: branch.id,
      });

      expect(result.id).toBe(branch.id);
      expect(result.branchName).toBe('Test Branch');
      expect(result.tenantId).toBe(testTenant.id);
    });

    it('should throw not found for non-existent branch', async () => {
      await expect(
        getBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchId: 'non-existent-id',
        })
      ).rejects.toThrow('not found');
    });

    it('should not allow access to branch from different tenant', async () => {
      const tenant2 = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: tenant2.id });

      await expect(
        getBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchId: otherBranch.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('updateBranchForCurrentTenantService - Update Branch', () => {
    it('should update branch name', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const result = await updateBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        branchNameInputValueOptional: 'Updated Name',
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.branchName).toBe('Updated Name');
    });

    it('should update branch slug', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const result = await updateBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        branchSlugInputValueOptional: 'new-slug',
      });

      expect(result.branchSlug).toBe('new-slug');
    });

    it('should update isActive flag', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id, isActive: true });

      const result = await updateBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        isActiveInputValueOptional: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('should create audit log entry on update', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await updateBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        branchNameInputValueOptional: 'Audited Update',
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: branch.id,
          action: 'UPDATE',
          entityType: 'BRANCH',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should reject duplicate slug on update', async () => {
      const branch1 = await createTestBranch({
        tenantId: testTenant.id,
        slug: 'existing-slug',
      });
      const branch2 = await createTestBranch({
        tenantId: testTenant.id,
        slug: 'other-slug',
      });

      await expect(
        updateBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchIdPathParam: branch2.id,
          branchSlugInputValueOptional: 'existing-slug',
        })
      ).rejects.toThrow('already exists');
    });

    it('should not allow updating branch from different tenant', async () => {
      const tenant2 = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: tenant2.id });

      await expect(
        updateBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchIdPathParam: otherBranch.id,
          branchNameInputValueOptional: 'Hacked Name',
        })
      ).rejects.toThrow();
    });
  });

  describe('archiveBranchForCurrentTenantService - Archive Branch', () => {
    it('should archive branch successfully', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const result = await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      expect(result.success).toBe(true);

      const archived = await getBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchId: branch.id,
      });
      expect(archived.isArchived).toBe(true);
      expect(archived.archivedByUserId).toBe(testUser.id);
    });

    it('should create audit log entry on archive', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: branch.id,
          action: 'DELETE',
          entityType: 'BRANCH',
        },
      });

      expect(auditEntry).toBeDefined();
    });

    it('should be idempotent when already archived', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      const result = await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      expect(result.success).toBe(true);
    });

    it('should not allow archiving branch from different tenant', async () => {
      const tenant2 = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: tenant2.id });

      await expect(
        archiveBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchIdPathParam: otherBranch.id,
          actorUserId: testUser.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('restoreBranchForCurrentTenantService - Restore Archived Branch', () => {
    it('should restore archived branch', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      const result = await restoreBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.success).toBe(true);

      const restored = await getBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchId: branch.id,
      });
      expect(restored.isArchived).toBe(false);
      expect(restored.archivedByUserId).toBeNull();
    });

    it('should create audit log entry on restore', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await archiveBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        actorUserId: testUser.id,
      });

      await restoreBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: branch.id,
          entityType: 'BRANCH',
        },
        orderBy: { createdAt: 'asc' },
      });

      const restoreEntry = auditEntries.find((e) => e.action === 'UPDATE');
      expect(restoreEntry).toBeDefined();
    });

    it('should be idempotent when not archived', async () => {
      const branch = await createTestBranch({ tenantId: testTenant.id });

      const result = await restoreBranchForCurrentTenantService({
        currentTenantId: testTenant.id,
        branchIdPathParam: branch.id,
      });

      expect(result.success).toBe(true);
    });

    it('should not allow restoring branch from different tenant', async () => {
      const tenant2 = await createTestTenant();
      const otherBranch = await createTestBranch({ tenantId: tenant2.id });

      await expect(
        restoreBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchIdPathParam: otherBranch.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should enforce tenant isolation across all operations', async () => {
      const tenant2 = await createTestTenant();
      const tenant2Branch = await createTestBranch({ tenantId: tenant2.id });

      // Cannot get
      await expect(
        getBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchId: tenant2Branch.id,
        })
      ).rejects.toThrow();

      // Cannot update
      await expect(
        updateBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchIdPathParam: tenant2Branch.id,
          branchNameInputValueOptional: 'Hacked',
        })
      ).rejects.toThrow();

      // Cannot archive
      await expect(
        archiveBranchForCurrentTenantService({
          currentTenantId: testTenant.id,
          branchIdPathParam: tenant2Branch.id,
          actorUserId: testUser.id,
        })
      ).rejects.toThrow();
    });
  });
});
