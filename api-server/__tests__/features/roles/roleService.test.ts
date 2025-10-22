// api-server/__tests__/features/roles/roleService.test.ts
import {
  createTenantRoleService,
  listTenantRolesService,
  getTenantRoleService,
  updateTenantRoleService,
  deleteTenantRoleService,
  restoreTenantRoleService,
} from '../../../src/services/role/roleService.js';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[ROLE-SVC] Role Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
  });

  describe('createTenantRoleService - Create Role', () => {
    it('should create role with permissions', async () => {
      const result = await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Custom Manager',
        description: 'Custom manager role',
        permissionKeys: ['products:read', 'products:write'],
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Custom Manager');
      expect(result.permissions).toContain('products:read');
      expect(result.permissions).toContain('products:write');
      expect(result.isSystem).toBe(false);
    });

    it('should create audit log entry', async () => {
      const result = await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Audited Role',
        permissionKeys: ['products:read'],
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: result.id,
          action: 'CREATE',
          entityType: 'ROLE',
        },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(testUser.id);
    });

    it('should reject duplicate role name in same tenant', async () => {
      await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Duplicate Role',
        permissionKeys: ['products:read'],
      });

      await expect(
        createTenantRoleService({
          currentTenantId: testTenant.id,
          name: 'Duplicate Role',
          permissionKeys: ['stock:read'],
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same role name in different tenants', async () => {
      const tenant2 = await createTestTenant();

      await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Shared Name',
        permissionKeys: ['products:read'],
      });

      const result2 = await createTenantRoleService({
        currentTenantId: tenant2.id,
        name: 'Shared Name',
        permissionKeys: ['stock:read'],
      });

      expect(result2).toBeDefined();
      expect(result2.tenantId).toBe(tenant2.id);
    });

    it('should reject invalid permission keys', async () => {
      await expect(
        createTenantRoleService({
          currentTenantId: testTenant.id,
          name: 'Invalid Perms',
          permissionKeys: ['nonexistent:permission'],
        })
      ).rejects.toThrow('Unknown permission key');
    });

    it('should create role with subset of permissions', async () => {
      const result = await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Limited Role',
        permissionKeys: ['products:read'],
      });

      expect(result.permissions).toHaveLength(1);
      expect(result.permissions).toContain('products:read');
    });
  });

  describe('listTenantRolesService - List Roles', () => {
    it('should list roles for tenant', async () => {
      await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });
      await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['stock:read'],
      });

      const result = await listTenantRolesService({
        currentTenantId: testTenant.id,
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.items.every((r) => r.tenantId === testTenant.id)).toBe(true);
    });

    it('should filter by search query', async () => {
      await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Special Manager',
        permissionKeys: ['products:read'],
      });

      const result = await listTenantRolesService({
        currentTenantId: testTenant.id,
        qOptional: 'special',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.some((r) => r.name.toLowerCase().includes('special'))).toBe(true);
    });

    it('should filter by isSystem flag', async () => {
      const result = await listTenantRolesService({
        currentTenantId: testTenant.id,
        isSystemOptional: true,
      });

      expect(result.items.every((r) => r.isSystem === true)).toBe(true);
    });

    it('should filter archived roles', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
      });

      const activeOnly = await listTenantRolesService({
        currentTenantId: testTenant.id,
        archivedFilterOptional: 'active-only',
      });

      expect(activeOnly.items.every((r) => !r.isArchived)).toBe(true);
    });

    it('should not return roles from other tenants', async () => {
      const tenant2 = await createTestTenant();
      await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['products:read'],
      });

      const result = await listTenantRolesService({
        currentTenantId: testTenant.id,
      });

      expect(result.items.every((r) => r.tenantId === testTenant.id)).toBe(true);
    });
  });

  describe('getTenantRoleService - Get Role by ID', () => {
    it('should retrieve role by ID with permissions', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });

      const result = await getTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
      });

      expect(result.id).toBe(role.id);
      expect(result.permissions.length).toBe(2);
      expect(result.permissions).toContain('products:read');
      expect(result.permissions).toContain('products:write');
    });

    it('should throw not found for non-existent role', async () => {
      await expect(
        getTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: 'non-existent-id',
        })
      ).rejects.toThrow('not found');
    });

    it('should not allow access to role from different tenant', async () => {
      const tenant2 = await createTestTenant();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['products:read'],
      });

      await expect(
        getTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: otherRole.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('updateTenantRoleService - Update Role', () => {
    it('should update role name and description', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const result = await updateTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        nameOptional: 'Updated Name',
        descriptionOptional: 'Updated description',
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
    });

    it('should update role permissions (add/remove)', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const result = await updateTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        permissionKeysOptional: ['products:read', 'products:write', 'stock:read'],
      });

      expect(result.permissions).toHaveLength(3);
      expect(result.permissions).toContain('products:write');
      expect(result.permissions).toContain('stock:read');
    });

    it('should create audit log entry on update', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await updateTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        nameOptional: 'Audited Update',
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: role.id,
          action: 'UPDATE',
          entityType: 'ROLE',
        },
      });

      expect(auditEntry).toBeDefined();
    });

    it('should not allow updating system roles', async () => {
      // Create a system role for this test
      const ownerRole = await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'OWNER',
        permissionKeys: ROLE_DEFS.OWNER as string[],
      });

      // Mark it as system role
      await prisma.role.update({
        where: { id: ownerRole.id },
        data: { isSystem: true },
      });

      await expect(
        updateTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: ownerRole.id,
          nameOptional: 'Hacked Owner',
        })
      ).rejects.toThrow('System roles cannot be modified');
    });

    it('should not allow updating archived roles', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
      });

      await expect(
        updateTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: role.id,
          nameOptional: 'Updated Name',
        })
      ).rejects.toThrow('Archived roles cannot be modified');
    });

    it('should reject duplicate name on update', async () => {
      await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Existing Role',
        permissionKeys: ['products:read'],
      });

      const role2 = await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'Other Role',
        permissionKeys: ['stock:read'],
      });

      await expect(
        updateTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: role2.id,
          nameOptional: 'Existing Role',
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('deleteTenantRoleService - Archive Role', () => {
    it('should archive role (soft delete)', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const result = await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.isArchived).toBe(true);
      expect(result.archivedByUserId).toBe(testUser.id);
    });

    it('should create audit log entry on archive', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: role.id,
          action: 'UPDATE',
          entityType: 'ROLE',
        },
      });

      expect(auditEntry).toBeDefined();
    });

    it('should not allow archiving system roles', async () => {
      // Create a system role for this test
      const ownerRole = await createTenantRoleService({
        currentTenantId: testTenant.id,
        name: 'OWNER',
        permissionKeys: ROLE_DEFS.OWNER as string[],
      });

      // Mark it as system role
      await prisma.role.update({
        where: { id: ownerRole.id },
        data: { isSystem: true },
      });

      await expect(
        deleteTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: ownerRole.id,
        })
      ).rejects.toThrow('System roles cannot be archived');
    });

    it('should not allow archiving role with active users', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      await expect(
        deleteTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: role.id,
        })
      ).rejects.toThrow('in use');
    });

    it('should reject if already archived', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
      });

      await expect(
        deleteTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: role.id,
        })
      ).rejects.toThrow('already archived');
    });
  });

  describe('restoreTenantRoleService - Restore Archived Role', () => {
    it('should restore archived role', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
      });

      const result = await restoreTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      expect(result.isArchived).toBe(false);
      expect(result.archivedByUserId).toBeNull();
    });

    it('should create audit log entry on restore', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await deleteTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
      });

      await restoreTenantRoleService({
        currentTenantId: testTenant.id,
        roleId: role.id,
        auditContextOptional: { actorUserId: testUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: role.id,
          entityType: 'ROLE',
        },
        orderBy: { createdAt: 'desc' },
      });

      const restoreEntry = auditEntries[0];
      expect(restoreEntry?.action).toBe('UPDATE');
    });

    it('should reject if not archived', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read'],
      });

      await expect(
        restoreTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: role.id,
        })
      ).rejects.toThrow('not archived');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should enforce tenant isolation across all operations', async () => {
      const tenant2 = await createTestTenant();
      const tenant2Role = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['products:read'],
      });

      // Cannot get
      await expect(
        getTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: tenant2Role.id,
        })
      ).rejects.toThrow();

      // Cannot update
      await expect(
        updateTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: tenant2Role.id,
          nameOptional: 'Hacked',
        })
      ).rejects.toThrow();

      // Cannot delete
      await expect(
        deleteTenantRoleService({
          currentTenantId: testTenant.id,
          roleId: tenant2Role.id,
        })
      ).rejects.toThrow();
    });
  });
});
