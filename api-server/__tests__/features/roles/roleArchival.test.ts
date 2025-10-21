// Role Archival tests
import request from 'supertest';
import type { Express } from 'express';
import { createConfiguredExpressApplicationInstance } from '../../../src/app.js';
import {
  createTestUser,
  createTestTenant,
  createTestRole,
  addUserToTenant,
  getPermissionsByKeys,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';
import { prismaClientInstance } from '../../../src/db/prismaClient.js';

describe('Role Archival', () => {
  let app: Express;
  let tenantId: string;
  let ownerUserId: string;
  let viewerUserId: string;
  let ownerRoleId: string;
  let viewerRoleId: string;

  beforeAll(async () => {
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;

    // Create tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Get permissions
    const rolesManagePerms = await getPermissionsByKeys(['roles:manage']);
    const readOnlyPerms = await getPermissionsByKeys(['products:read']);

    // Create roles
    const ownerRole = await createTestRole({
      tenantId,
      name: 'OWNER_TEST',
      permissionIds: rolesManagePerms.map((p) => p.id),
    });
    ownerRoleId = ownerRole.id;

    const viewerRole = await createTestRole({
      tenantId,
      name: 'VIEWER_TEST',
      permissionIds: readOnlyPerms.map((p) => p.id),
    });
    viewerRoleId = viewerRole.id;

    // Create users
    const owner = await createTestUser();
    ownerUserId = owner.id;
    await addUserToTenant(ownerUserId, tenantId, ownerRole.id);

    const viewer = await createTestUser();
    viewerUserId = viewer.id;
    await addUserToTenant(viewerUserId, tenantId, viewerRole.id);
  });

  describe('Archive Role (DELETE /api/roles/:roleId)', () => {
    it('should archive a custom role when user has roles:manage permission', async () => {
      // Create a custom role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 1',
        permissionIds: [],
      });

      const response = await request(app)
        .delete(`/api/roles/${customRole.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBeDefined();
      expect(response.body.data.role.isArchived).toBe(true);
      expect(response.body.data.role.archivedAt).toBeDefined();
      expect(response.body.data.role.archivedByUserId).toBe(ownerUserId);

      // Verify the role is archived in the database
      const role = await prismaClientInstance.role.findUnique({
        where: { id: customRole.id },
        select: { isArchived: true, archivedAt: true, archivedByUserId: true },
      });

      expect(role?.isArchived).toBe(true);
      expect(role?.archivedAt).toBeDefined();
      expect(role?.archivedByUserId).toBe(ownerUserId);
    });

    it('should not allow user without roles:manage to archive role', async () => {
      // Create a custom role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 2',
        permissionIds: [],
      });

      const response = await request(app)
        .delete(`/api/roles/${customRole.id}`)
        .set('Cookie', createSessionCookie(viewerUserId, tenantId));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should not allow archiving system roles', async () => {
      // Create a system role
      const systemRole = await prismaClientInstance.role.create({
        data: {
          tenantId,
          name: 'System Role Test',
          isSystem: true,
        },
      });

      const response = await request(app)
        .delete(`/api/roles/${systemRole.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('System roles cannot be archived');

      // Verify the role is NOT archived
      const role = await prismaClientInstance.role.findUnique({
        where: { id: systemRole.id },
        select: { isArchived: true },
      });
      expect(role?.isArchived).toBe(false);
    });

    it('should not allow archiving role with active memberships', async () => {
      // Create a custom role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 3',
        permissionIds: [],
      });

      // Create a user with this role
      const user = await createTestUser();
      await addUserToTenant(user.id, tenantId, customRole.id);

      const response = await request(app)
        .delete(`/api/roles/${customRole.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('in use by');
      expect(response.body.error.userFacingMessage).toContain('cannot be archived');
    });

    it('should return error when archiving already archived role', async () => {
      // Create and archive a role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 4',
        permissionIds: [],
      });

      await prismaClientInstance.role.update({
        where: { id: customRole.id },
        data: { isArchived: true, archivedAt: new Date() },
      });

      const response = await request(app)
        .delete(`/api/roles/${customRole.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('already archived');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .delete('/api/roles/non-existent-id')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Restore Role (POST /api/roles/:roleId/restore)', () => {
    it('should restore an archived role when user has roles:manage permission', async () => {
      // Create and archive a role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 5',
        permissionIds: [],
      });

      await prismaClientInstance.role.update({
        where: { id: customRole.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUserId },
      });

      const response = await request(app)
        .post(`/api/roles/${customRole.id}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBeDefined();
      expect(response.body.data.role.isArchived).toBe(false);
      expect(response.body.data.role.archivedAt).toBeNull();
      expect(response.body.data.role.archivedByUserId).toBeNull();

      // Verify the role is restored in the database
      const role = await prismaClientInstance.role.findUnique({
        where: { id: customRole.id },
        select: { isArchived: true, archivedAt: true, archivedByUserId: true },
      });

      expect(role?.isArchived).toBe(false);
      expect(role?.archivedAt).toBeNull();
      expect(role?.archivedByUserId).toBeNull();
    });

    it('should not allow user without roles:manage to restore role', async () => {
      // Create and archive a role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 6',
        permissionIds: [],
      });

      await prismaClientInstance.role.update({
        where: { id: customRole.id },
        data: { isArchived: true, archivedAt: new Date() },
      });

      const response = await request(app)
        .post(`/api/roles/${customRole.id}/restore`)
        .set('Cookie', createSessionCookie(viewerUserId, tenantId));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return error when restoring non-archived role', async () => {
      // Create a non-archived role
      const customRole = await createTestRole({
        tenantId,
        name: 'Custom Role 7',
        permissionIds: [],
      });

      const response = await request(app)
        .post(`/api/roles/${customRole.id}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('not archived');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .post('/api/roles/non-existent-id/restore')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('List Roles with Archived Filter (GET /api/roles)', () => {
    let activeRoleId: string;
    let archivedRoleId: string;

    beforeAll(async () => {
      // Create an active role
      const activeRole = await createTestRole({
        tenantId,
        name: 'Active Role List',
        permissionIds: [],
      });
      activeRoleId = activeRole.id;

      // Create and archive a role
      const archivedRole = await createTestRole({
        tenantId,
        name: 'Archived Role List',
        permissionIds: [],
      });
      await prismaClientInstance.role.update({
        where: { id: archivedRole.id },
        data: { isArchived: true, archivedAt: new Date() },
      });
      archivedRoleId = archivedRole.id;
    });

    it('should return only active roles by default (archivedFilter=active-only)', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);

      const roleIds = response.body.data.items.map((r: any) => r.id);
      expect(roleIds).toContain(activeRoleId);
      expect(roleIds).not.toContain(archivedRoleId);

      // All returned roles should be active
      response.body.data.items.forEach((role: any) => {
        expect(role.isArchived).toBe(false);
      });
    });

    it('should return only active roles when archivedFilter=active-only is explicit', async () => {
      const response = await request(app)
        .get('/api/roles?archivedFilter=active-only')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const roleIds = response.body.data.items.map((r: any) => r.id);
      expect(roleIds).toContain(activeRoleId);
      expect(roleIds).not.toContain(archivedRoleId);
    });

    it('should return only archived roles when archivedFilter=archived-only', async () => {
      const response = await request(app)
        .get('/api/roles?archivedFilter=archived-only')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const roleIds = response.body.data.items.map((r: any) => r.id);
      expect(roleIds).not.toContain(activeRoleId);
      expect(roleIds).toContain(archivedRoleId);

      // All returned roles should be archived
      response.body.data.items.forEach((role: any) => {
        expect(role.isArchived).toBe(true);
      });
    });

    it('should return all roles (active + archived) when archivedFilter=all', async () => {
      const response = await request(app)
        .get('/api/roles?archivedFilter=all')
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const roleIds = response.body.data.items.map((r: any) => r.id);
      expect(roleIds).toContain(activeRoleId);
      expect(roleIds).toContain(archivedRoleId);

      // Should contain both active and archived roles
      const hasActive = response.body.data.items.some((r: any) => !r.isArchived);
      const hasArchived = response.body.data.items.some((r: any) => r.isArchived);
      expect(hasActive).toBe(true);
      expect(hasArchived).toBe(true);
    });
  });

  describe('Get Archived Role (GET /api/roles/:roleId)', () => {
    it('should allow accessing archived role detail page', async () => {
      // Create and archive a role
      const customRole = await createTestRole({
        tenantId,
        name: 'Archived Role Detail',
        permissionIds: [],
      });

      await prismaClientInstance.role.update({
        where: { id: customRole.id },
        data: { isArchived: true, archivedAt: new Date(), archivedByUserId: ownerUserId },
      });

      const response = await request(app)
        .get(`/api/roles/${customRole.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBeDefined();
      expect(response.body.data.role.id).toBe(customRole.id);
      expect(response.body.data.role.isArchived).toBe(true);
      expect(response.body.data.role.archivedAt).toBeDefined();
      expect(response.body.data.role.archivedByUserId).toBe(ownerUserId);
    });
  });

  describe('Update Archived Role (PUT /api/roles/:roleId)', () => {
    it('should not allow updating archived role', async () => {
      // Create and archive a role
      const customRole = await createTestRole({
        tenantId,
        name: 'Archived Role Update Test',
        permissionIds: [],
      });

      await prismaClientInstance.role.update({
        where: { id: customRole.id },
        data: { isArchived: true, archivedAt: new Date() },
      });

      const response = await request(app)
        .put(`/api/roles/${customRole.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId))
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.userFacingMessage).toContain('Archived roles cannot be modified');
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should not allow archiving role from different tenant', async () => {
      // Create another tenant and role
      const tenant2 = await createTestTenant();
      const role2 = await createTestRole({
        tenantId: tenant2.id,
        name: 'Other Tenant Role',
        permissionIds: [],
      });

      const response = await request(app)
        .delete(`/api/roles/${role2.id}`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should not allow restoring role from different tenant', async () => {
      // Create another tenant and archived role
      const tenant2 = await createTestTenant();
      const role2 = await createTestRole({
        tenantId: tenant2.id,
        name: 'Other Tenant Role 2',
        permissionIds: [],
      });

      await prismaClientInstance.role.update({
        where: { id: role2.id },
        data: { isArchived: true, archivedAt: new Date() },
      });

      const response = await request(app)
        .post(`/api/roles/${role2.id}/restore`)
        .set('Cookie', createSessionCookie(ownerUserId, tenantId));

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
