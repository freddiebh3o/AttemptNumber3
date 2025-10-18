// User Archival Feature acceptance tests
import request from 'supertest';
import type { Express } from 'express';
import { createConfiguredExpressApplicationInstance } from '../../src/app.js';
import { prisma } from '../helpers/db.js';
import {
  createTestUser,
  createTestTenant,
  createTestRole,
  addUserToTenant,
  getPermissionsByKeys,
} from '../helpers/factories.js';
import { createSessionCookie } from '../helpers/auth.js';

describe('User Archival Feature', () => {
  let app: Express;
  let tenantId: string;
  let ownerId: string;
  let viewerId: string;
  let targetUserId: string;
  let ownerRoleId: string;
  let viewerRoleId: string;

  beforeAll(async () => {
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;

    // Create tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Get permissions
    const usersManagePerm = await getPermissionsByKeys(['users:manage']);

    // Create roles
    const ownerRole = await createTestRole({
      tenantId,
      name: 'OWNER',
      permissionIds: usersManagePerm.map((p) => p.id),
    });
    ownerRoleId = ownerRole.id;

    const viewerRole = await createTestRole({
      tenantId,
      name: 'VIEWER',
      permissionIds: [],
    });
    viewerRoleId = viewerRole.id;

    // Create users
    const owner = await createTestUser();
    ownerId = owner.id;
    await addUserToTenant(ownerId, tenantId, ownerRoleId);

    const viewer = await createTestUser();
    viewerId = viewer.id;
    await addUserToTenant(viewerId, tenantId, viewerRoleId);

    const targetUser = await createTestUser();
    targetUserId = targetUser.id;
    await addUserToTenant(targetUserId, tenantId, viewerRoleId);
  });

  describe('Service Layer Tests', () => {
    it('should list users excluding archived by default (active-only)', async () => {
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(3); // At least our 3 test users
    });

    it('should archive user membership successfully', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasArchivedMembership).toBe(true);

      // Verify in database
      const membership = await prisma.userTenantMembership.findUnique({
        where: { userId_tenantId: { userId: targetUserId, tenantId } },
      });
      expect(membership?.isArchived).toBe(true);
      expect(membership?.archivedAt).toBeTruthy();
      expect(membership?.archivedByUserId).toBe(ownerId);
    });

    it('should list users with active-only filter excluding archived', async () => {
      const response = await request(app)
        .get('/api/tenant-users?archivedFilter=active-only')
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.every((u: any) => !u.isArchived)).toBe(true);
      // Should not include target user (archived)
      expect(response.body.data.items.find((u: any) => u.userId === targetUserId)).toBeUndefined();
    });

    it('should list users with archived-only filter showing only archived', async () => {
      const response = await request(app)
        .get('/api/tenant-users?archivedFilter=archived-only')
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.every((u: any) => u.isArchived)).toBe(true);
      // Should include target user
      expect(response.body.data.items.find((u: any) => u.userId === targetUserId)).toBeTruthy();
    });

    it('should list users with all filter showing both active and archived', async () => {
      const response = await request(app)
        .get('/api/tenant-users?archivedFilter=all')
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should include both archived and active users
      const targetUser = response.body.data.items.find((u: any) => u.userId === targetUserId);
      expect(targetUser?.isArchived).toBe(true);
      const ownerUser = response.body.data.items.find((u: any) => u.userId === ownerId);
      expect(ownerUser?.isArchived).toBe(false);
    });

    it('should return archived memberships via getUserForCurrentTenantService', async () => {
      const response = await request(app)
        .get(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isArchived).toBe(true);
      expect(response.body.data.user.archivedAt).toBeTruthy();
      expect(response.body.data.user.archivedByUserId).toBe(ownerId);
    });

    it('should restore archived user membership', async () => {
      const response = await request(app)
        .post(`/api/tenant-users/${targetUserId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasRestoredMembership).toBe(true);

      // Verify in database
      const membership = await prisma.userTenantMembership.findUnique({
        where: { userId_tenantId: { userId: targetUserId, tenantId } },
      });
      expect(membership?.isArchived).toBe(false);
      expect(membership?.archivedAt).toBeNull();
      expect(membership?.archivedByUserId).toBeNull();
    });

    it('should prevent archiving own membership', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${ownerId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('Cannot archive own membership');
    });

    it('should return false when archiving already archived membership', async () => {
      // First archive
      await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Try to archive again
      const response = await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.data.hasArchivedMembership).toBe(false);
    });

    it('should return false when restoring non-archived membership', async () => {
      // Ensure it's restored first
      await request(app)
        .post(`/api/tenant-users/${targetUserId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Try to restore again
      const response = await request(app)
        .post(`/api/tenant-users/${targetUserId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.data.hasRestoredMembership).toBe(false);
    });

    it('should preserve audit trail for archive action', async () => {
      await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Check that audit events exist for this user
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          tenantId,
          entityType: 'USER',
          entityId: targetUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Should have some audit events (at least from user creation and archival)
      expect(auditEvents.length).toBeGreaterThan(0);
    });

    it('should preserve audit trail for restore action', async () => {
      await request(app)
        .post(`/api/tenant-users/${targetUserId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Check that audit events exist for this user
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          tenantId,
          entityType: 'USER',
          entityId: targetUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Should have some audit events (from creation, archival, and restore)
      expect(auditEvents.length).toBeGreaterThan(0);
    });

    it('should show "Archived user" message in activity log when archiving', async () => {
      // Archive the user
      await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Fetch activity log
      const response = await request(app)
        .get(`/api/tenant-users/${targetUserId}/activity`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Find the most recent archive event
      const archiveEvent = response.body.data.items.find(
        (item: any) => item.action === 'UPDATE' && item.message === 'Archived user'
      );
      expect(archiveEvent).toBeDefined();
      expect(archiveEvent.messageParts?.archived).toEqual({
        before: false,
        after: true,
      });
    });

    it('should show "Restored user" message in activity log when restoring', async () => {
      // Ensure user is archived first
      await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Restore the user
      await request(app)
        .post(`/api/tenant-users/${targetUserId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Fetch activity log
      const response = await request(app)
        .get(`/api/tenant-users/${targetUserId}/activity`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Find the most recent restore event
      const restoreEvent = response.body.data.items.find(
        (item: any) => item.action === 'UPDATE' && item.message === 'Restored user'
      );
      expect(restoreEvent).toBeDefined();
      expect(restoreEvent.messageParts?.archived).toEqual({
        before: true,
        after: false,
      });
    });
  });

  describe('Authentication & Authorization Tests', () => {
    it('should reject archived user authentication', async () => {
      // Archive the viewer
      await request(app)
        .delete(`/api/tenant-users/${viewerId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Try to access with archived user's cookie
      const response = await request(app)
        .get('/api/tenant-users')
        .set('Cookie', createSessionCookie(viewerId, tenantId));

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      // Restore for cleanup
      await request(app)
        .post(`/api/tenant-users/${viewerId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));
    });

    it('should deny archive access to users without users:manage permission', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${targetUserId}`)
        .set('Cookie', createSessionCookie(viewerId, tenantId));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should deny restore access to users without users:manage permission', async () => {
      const response = await request(app)
        .post(`/api/tenant-users/${targetUserId}/restore`)
        .set('Cookie', createSessionCookie(viewerId, tenantId));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Multi-tenant Isolation Tests', () => {
    let otherTenantId: string;
    let otherUserId: string;

    beforeAll(async () => {
      const otherTenant = await createTestTenant();
      otherTenantId = otherTenant.id;

      const otherUser = await createTestUser();
      otherUserId = otherUser.id;

      const otherRole = await createTestRole({
        tenantId: otherTenantId,
        name: 'VIEWER',
        permissionIds: [],
      });

      await addUserToTenant(otherUserId, otherTenantId, otherRole.id);
    });

    it('should prevent archiving users from other tenants', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${otherUserId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Returns 200 but with hasArchivedMembership: false when user not in tenant
      expect(response.status).toBe(200);
      expect(response.body.data.hasArchivedMembership).toBe(false);
    });

    it('should prevent restoring users from other tenants', async () => {
      const response = await request(app)
        .post(`/api/tenant-users/${otherUserId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(404);
    });
  });

  describe('Owner Role Protection Tests', () => {
    let secondOwnerId: string;

    beforeAll(async () => {
      const secondOwner = await createTestUser();
      secondOwnerId = secondOwner.id;
      await addUserToTenant(secondOwnerId, tenantId, ownerRoleId);
    });

    it('should allow archiving owner when multiple owners exist', async () => {
      const response = await request(app)
        .delete(`/api/tenant-users/${secondOwnerId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.data.hasArchivedMembership).toBe(true);

      // Restore for cleanup
      await request(app)
        .post(`/api/tenant-users/${secondOwnerId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));
    });

    it('should prevent archiving last active owner', async () => {
      // Archive second owner first so we have only one active owner (ownerId)
      await request(app)
        .delete(`/api/tenant-users/${secondOwnerId}`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Give viewer users:manage permission so they can try to archive
      const adminRole = await createTestRole({
        tenantId,
        name: 'ADMIN_TEST',
        permissionIds: (await getPermissionsByKeys(['users:manage'])).map((p) => p.id),
      });

      // Change viewer to admin
      await prisma.userTenantMembership.update({
        where: { userId_tenantId: { userId: viewerId, tenantId } },
        data: { roleId: adminRole.id },
      });

      // Now viewerId (non-owner admin) tries to archive the last owner
      // This should fail with 409 (can't delete last owner)
      const response = await request(app)
        .delete(`/api/tenant-users/${ownerId}`)
        .set('Cookie', createSessionCookie(viewerId, tenantId));

      expect(response.status).toBe(409);
      expect(response.body.error.errorCode).toContain('LAST_OWNER');

      // Restore second owner for cleanup
      await request(app)
        .post(`/api/tenant-users/${secondOwnerId}/restore`)
        .set('Cookie', createSessionCookie(ownerId, tenantId));

      // Restore viewer back to viewer role
      await prisma.userTenantMembership.update({
        where: { userId_tenantId: { userId: viewerId, tenantId } },
        data: { roleId: viewerRoleId },
      });
    });
  });
});
