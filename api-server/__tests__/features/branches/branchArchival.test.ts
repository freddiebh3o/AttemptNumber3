// Branch Archival tests
import request from 'supertest';
import type { Express } from 'express';
import { createConfiguredExpressApplicationInstance } from '../../../src/app.js';
import {
  createTestUser,
  createTestTenant,
  createTestRole,
  addUserToTenant,
  getPermissionsByKeys,
  createTestBranch,
  createTestProduct,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { prismaClientInstance } from '../../../src/db/prismaClient.js';

describe('Branch Archival', () => {
  let app: Express;
  let tenantId: string;
  let ownerUserId: string;
  let viewerUserId: string;
  let branchId: string;

  beforeAll(async () => {
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;

    // Create tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Get permissions
    const managePerms = await getPermissionsByKeys(['tenant:manage']);
    const readOnlyPerms = await getPermissionsByKeys(['tenant:read']);

    // Create roles
    const ownerRole = await createTestRole({
      tenantId,
      name: 'OWNER',
      permissionIds: managePerms.map((p) => p.id),
    });

    const viewerRole = await createTestRole({
      tenantId,
      name: 'VIEWER',
      permissionIds: readOnlyPerms.map((p) => p.id),
    });

    // Create users
    const owner = await createTestUser();
    ownerUserId = owner.id;
    await addUserToTenant(ownerUserId, tenantId, ownerRole.id);

    const viewer = await createTestUser();
    viewerUserId = viewer.id;
    await addUserToTenant(viewerUserId, tenantId, viewerRole.id);

    // Create a branch for testing
    const branch = await createTestBranch({
      tenantId,
      slug: 'test-branch',
      name: 'Test Branch',
    });
    branchId = branch.id;
  });

  describe('Archive Branch', () => {
    it('should archive a branch when user has tenant:manage permission', async () => {
      const response = await request(app)
        .delete(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);

      // Verify the branch is archived in the database
      const branch = await prismaClientInstance.branch.findUnique({
        where: { id: branchId },
        select: { isArchived: true, archivedAt: true, archivedByUserId: true },
      });

      expect(branch?.isArchived).toBe(true);
      expect(branch?.archivedAt).toBeDefined();
      expect(branch?.archivedByUserId).toBe(ownerUserId);
    });

    it('should not allow user without tenant:manage to archive branch', async () => {
      // Create another branch for this test
      const branch = await createTestBranch({
        tenantId,
        slug: 'test-branch-2',
        name: 'Test Branch 2',
      });

      const response = await request(app)
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', createSessionCookie(viewerUserId, tenantId));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should allow archiving branch with stock records', async () => {
      // Create a branch with stock data
      const branch = await createTestBranch({
        tenantId,
        slug: 'warehouse-branch',
        name: 'Warehouse Branch',
      });

      // Create product and stock for this branch
      const product = await createTestProduct({
        tenantId,
        name: 'Test Product',
        sku: 'TEST-001',
        pricePence: 1000,
      });

      // Add stock to the branch
      await prismaClientInstance.productStock.create({
        data: {
          tenantId,
          branchId: branch.id,
          productId: product.id,
          qtyOnHand: 100,
        },
      });

      const response = await request(app)
        .delete(`/api/branches/${branch.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify the branch is archived
      const archivedBranch = await prismaClientInstance.branch.findUnique({
        where: { id: branch.id },
        select: { isArchived: true },
      });
      expect(archivedBranch?.isArchived).toBe(true);
    });

    it('should return success when archiving already archived branch', async () => {
      // Branch should already be archived from first test
      const response = await request(app)
        .delete(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Restore Branch', () => {
    it('should restore an archived branch', async () => {
      const response = await request(app)
        .post(`/api/branches/${branchId}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify the branch is restored in the database
      const branch = await prismaClientInstance.branch.findUnique({
        where: { id: branchId },
        select: { isArchived: true, archivedAt: true, archivedByUserId: true },
      });

      expect(branch?.isArchived).toBe(false);
      expect(branch?.archivedAt).toBeNull();
      expect(branch?.archivedByUserId).toBeNull();
    });

    it('should not allow user without tenant:manage to restore branch', async () => {
      // Archive first
      await request(app)
        .delete(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      // Try to restore as viewer
      const response = await request(app)
        .post(`/api/branches/${branchId}/restore`)
        .set('Cookie', createSessionCookie(viewerUserId, tenantId));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return success when restoring non-archived branch', async () => {
      // Restore first
      await request(app)
        .post(`/api/branches/${branchId}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      // Try to restore again
      const response = await request(app)
        .post(`/api/branches/${branchId}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('List Branches with Archive Filter', () => {
    let activeBranchId: string;
    let archivedBranchId: string;

    beforeAll(async () => {
      // Create active branch
      const activeBranch = await createTestBranch({
        tenantId,
        slug: 'active-branch',
        name: 'Active Branch',
      });
      activeBranchId = activeBranch.id;

      // Create and archive branch
      const branchToArchive = await createTestBranch({
        tenantId,
        slug: 'archived-branch',
        name: 'Archived Branch',
      });
      archivedBranchId = branchToArchive.id;

      await request(app)
        .delete(`/api/branches/${archivedBranchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));
    });

    it('should list only active branches by default', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const branches = response.body.data.items;
      const archivedBranches = branches.filter((b: any) => b.isArchived);
      expect(archivedBranches.length).toBe(0);

      // Should find the active branch
      const activeBranch = branches.find((b: any) => b.id === activeBranchId);
      expect(activeBranch).toBeDefined();
      expect(activeBranch.isArchived).toBe(false);
    });

    it('should list only active branches with archivedFilter=active-only', async () => {
      const response = await request(app)
        .get('/api/branches?archivedFilter=active-only')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const branches = response.body.data.items;
      const archivedBranches = branches.filter((b: any) => b.isArchived);
      expect(archivedBranches.length).toBe(0);
    });

    it('should list only archived branches with archivedFilter=archived-only', async () => {
      const response = await request(app)
        .get('/api/branches?archivedFilter=archived-only')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const branches = response.body.data.items;
      const activeBranches = branches.filter((b: any) => !b.isArchived);
      expect(activeBranches.length).toBe(0);

      // Should find the archived branch
      const archivedBranch = branches.find((b: any) => b.id === archivedBranchId);
      expect(archivedBranch).toBeDefined();
      expect(archivedBranch.isArchived).toBe(true);
    });

    it('should list all branches with archivedFilter=all', async () => {
      const response = await request(app)
        .get('/api/branches?archivedFilter=all')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const branches = response.body.data.items;

      // Should have both active and archived branches
      const activeBranch = branches.find((b: any) => b.id === activeBranchId);
      const archivedBranch = branches.find((b: any) => b.id === archivedBranchId);

      expect(activeBranch).toBeDefined();
      expect(activeBranch.isArchived).toBe(false);

      expect(archivedBranch).toBeDefined();
      expect(archivedBranch.isArchived).toBe(true);
    });
  });

  describe('Get Branch (archived access)', () => {
    it('should allow access to archived branch detail page', async () => {
      // Archive branch first
      await request(app)
        .delete(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      // Try to get archived branch
      const response = await request(app)
        .get(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.id).toBe(branchId);
      expect(response.body.data.branch.isArchived).toBe(true);
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should not allow archiving branches from other tenants', async () => {
      // Create another tenant and user
      const tenant2 = await createTestTenant();
      const managePerms = await getPermissionsByKeys(['tenant:manage']);
      const role2 = await createTestRole({
        tenantId: tenant2.id,
        name: 'OWNER',
        permissionIds: managePerms.map((p) => p.id),
      });
      const user2 = await createTestUser();
      await addUserToTenant(user2.id, tenant2.id, role2.id);

      // Try to archive branch from tenant 1 using tenant 2 credentials
      const response = await request(app)
        .delete(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(user2.id, tenant2.id));

      expect(response.status).toBe(404);
    });
  });

  describe('Audit Trail', () => {
    it('should create audit event when archiving branch', async () => {
      // Restore first to ensure clean state
      await request(app)
        .post(`/api/branches/${branchId}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      // Archive the branch
      await request(app)
        .delete(`/api/branches/${branchId}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      // Check audit events
      const auditEvents = await prismaClientInstance.auditEvent.findMany({
        where: {
          tenantId,
          entityType: 'BRANCH',
          entityId: branchId,
          action: 'DELETE',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(auditEvents.length).toBeGreaterThan(0);
      expect(auditEvents[0]?.actorUserId).toBe(ownerUserId);
    });

    it('should create audit event when restoring branch', async () => {
      // Restore the branch
      await request(app)
        .post(`/api/branches/${branchId}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      // Check audit events
      const auditEvents = await prismaClientInstance.auditEvent.findMany({
        where: {
          tenantId,
          entityType: 'BRANCH',
          entityId: branchId,
          action: 'UPDATE',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(auditEvents.length).toBeGreaterThan(0);
    });
  });
});
