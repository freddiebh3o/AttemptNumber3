// api-server/__tests__/features/tenantUsers/tenantUserService.test.ts
import {
  createOrAttachUserToTenantService,
  listUsersForCurrentTenantService,
  getUserForCurrentTenantService,
  updateTenantUserService,
  removeUserFromTenantService,
  restoreUserMembershipService,
} from '../../../src/services/tenantUsers/tenantUserService.js';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
  createTestBranch,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[TENANT-USER-SVC] Tenant User Service', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let actorUser: Awaited<ReturnType<typeof createTestUser>>;
  let ownerRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;
  let editorRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    actorUser = await createTestUser();

    // Create system roles with proper names for OWNER checking logic
    ownerRole = await createTestRoleWithPermissions({
      name: 'OWNER',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.OWNER,
      isSystem: true,
    });

    editorRole = await createTestRoleWithPermissions({
      name: 'EDITOR',
      tenantId: testTenant.id,
      permissionKeys: ROLE_DEFS.EDITOR,
      isSystem: false,
    });
  });

  describe('createOrAttachUserToTenantService - Invite User', () => {
    it('should create new user and add to tenant', async () => {
      const timestamp = Date.now();
      const email = `newuser-${timestamp}@test.com`;

      const result = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'Password123!',
        roleId: editorRole.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      expect(result).toBeDefined();
      expect(result.userEmailAddress).toBe(email);
      expect(result.role?.id).toBe(editorRole.id);

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { userEmailAddress: email },
      });
      expect(user).toBeDefined();
    });

    it('should attach existing user to tenant', async () => {
      const existingUser = await createTestUser();

      const result = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email: existingUser.userEmailAddress,
        password: 'ignored-password',
        roleId: editorRole.id,
      });

      expect(result.userId).toBe(existingUser.id);
      expect(result.role?.id).toBe(editorRole.id);
    });

    it('should assign role to user', async () => {
      const timestamp = Date.now();
      const email = `roleuser-${timestamp}@test.com`;

      const result = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'Password123!',
        roleId: ownerRole.id,
      });

      expect(result.role?.name).toBe('OWNER');
      expect(result.role?.permissions.length).toBeGreaterThan(0);
    });

    it('should assign branches to user', async () => {
      const branch1 = await createTestBranch({ tenantId: testTenant.id });
      const branch2 = await createTestBranch({ tenantId: testTenant.id });
      const timestamp = Date.now();
      const email = `branchuser-${timestamp}@test.com`;

      const result = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'Password123!',
        roleId: editorRole.id,
        branchIdsOptional: [branch1.id, branch2.id],
      });

      expect(result.branches.length).toBe(2);
      expect(result.branches.some((b) => b.id === branch1.id)).toBe(true);
      expect(result.branches.some((b) => b.id === branch2.id)).toBe(true);
    });

    it('should create audit log for new user', async () => {
      const timestamp = Date.now();
      const email = `audituser-${timestamp}@test.com`;

      const result = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'Password123!',
        roleId: editorRole.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: result.userId,
          entityType: 'USER',
        },
      });

      expect(auditEntries.length).toBeGreaterThan(0);
      const createEntry = auditEntries.find((e) => e.action === 'CREATE');
      expect(createEntry).toBeDefined();
    });

    it('should create audit log for role assignment', async () => {
      const timestamp = Date.now();
      const email = `roleaudit-${timestamp}@test.com`;

      const result = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'Password123!',
        roleId: editorRole.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: result.userId,
          entityType: 'USER',
          action: 'ROLE_ASSIGN',
        },
      });

      expect(auditEntries.length).toBeGreaterThan(0);
    });

    it('should reject invalid role for tenant', async () => {
      const otherTenant = await createTestTenant();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['products:read'],
      });

      const timestamp = Date.now();
      const email = `invalid-${timestamp}@test.com`;

      await expect(
        createOrAttachUserToTenantService({
          currentTenantId: testTenant.id,
          email,
          password: 'Password123!',
          roleId: otherRole.id,
        })
      ).rejects.toThrow('Invalid role');
    });

    it('should prevent duplicate membership (idempotent)', async () => {
      const timestamp = Date.now();
      const email = `duplicate-${timestamp}@test.com`;

      await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'Password123!',
        roleId: editorRole.id,
      });

      // Second call should succeed (update role if different)
      const result2 = await createOrAttachUserToTenantService({
        currentTenantId: testTenant.id,
        email,
        password: 'ignored',
        roleId: ownerRole.id,
      });

      expect(result2.role?.name).toBe('OWNER');
    });
  });

  describe('listUsersForCurrentTenantService - List Users', () => {
    it('should list users for tenant', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await createTestMembership({
        userId: user1.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });
      await createTestMembership({
        userId: user2.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.items.every((u) => u.role !== null)).toBe(true);
    });

    it('should support pagination with limit', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await createTestMembership({
        userId: user1.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });
      await createTestMembership({
        userId: user2.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
        limitOptional: 1,
      });

      expect(result.items.length).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.nextCursor).toBeDefined();
    });

    it('should filter by search query (email)', async () => {
      const timestamp = Date.now();
      const searchUser = await createTestUser({
        email: `searchable-${timestamp}@test.com`,
      });
      await createTestMembership({
        userId: searchUser.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
        qOptional: 'searchable',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(
        result.items.some((u) => u.userEmailAddress.includes('searchable'))
      ).toBe(true);
    });

    it('should filter by role', async () => {
      const ownerUser = await createTestUser();
      const editorUser = await createTestUser();

      await createTestMembership({
        userId: ownerUser.id,
        tenantId: testTenant.id,
        roleId: ownerRole.id,
      });
      await createTestMembership({
        userId: editorUser.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
        roleIdsOptional: [ownerRole.id],
      });

      expect(result.items.every((u) => u.role?.id === ownerRole.id)).toBe(true);
    });

    it('should filter archived users', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
      });

      const activeOnly = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
        archivedFilterOptional: 'active-only',
      });

      expect(activeOnly.items.every((u) => !u.isArchived)).toBe(true);

      const archivedOnly = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
        archivedFilterOptional: 'archived-only',
      });

      expect(archivedOnly.items.every((u) => u.isArchived)).toBe(true);
    });

    it('should include branch memberships', async () => {
      const user = await createTestUser();
      const branch = await createTestBranch({ tenantId: testTenant.id });

      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await prisma.userBranchMembership.create({
        data: {
          userId: user.id,
          tenantId: testTenant.id,
          branchId: branch.id,
        },
      });

      const result = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      const userWithBranches = result.items.find((u) => u.userId === user.id);
      expect(userWithBranches?.branches.length).toBeGreaterThan(0);
    });

    it('should not return users from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['products:read'],
      });

      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      const result = await listUsersForCurrentTenantService({
        currentTenantId: testTenant.id,
      });

      expect(result.items.every((u) => u.userId !== otherUser.id)).toBe(true);
    });
  });

  describe('getUserForCurrentTenantService - Get User by ID', () => {
    it('should retrieve user by ID', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await getUserForCurrentTenantService({
        currentTenantId: testTenant.id,
        targetUserId: user.id,
      });

      expect(result.userId).toBe(user.id);
      expect(result.userEmailAddress).toBe(user.userEmailAddress);
      expect(result.role?.id).toBe(editorRole.id);
    });

    it('should throw not found for non-member user', async () => {
      const nonMemberUser = await createTestUser();

      await expect(
        getUserForCurrentTenantService({
          currentTenantId: testTenant.id,
          targetUserId: nonMemberUser.id,
        })
      ).rejects.toThrow('not a member');
    });

    it('should not allow access to user from different tenant', async () => {
      const otherTenant = await createTestTenant();
      const otherUser = await createTestUser();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['products:read'],
      });

      await createTestMembership({
        userId: otherUser.id,
        tenantId: otherTenant.id,
        roleId: otherRole.id,
      });

      await expect(
        getUserForCurrentTenantService({
          currentTenantId: testTenant.id,
          targetUserId: otherUser.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('updateTenantUserService - Update User', () => {
    it('should update user role', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await updateTenantUserService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
        newRoleIdOptional: ownerRole.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      expect(result.role?.id).toBe(ownerRole.id);
      expect(result.role?.name).toBe('OWNER');
    });

    it('should update user branches', async () => {
      const user = await createTestUser();
      const branch1 = await createTestBranch({ tenantId: testTenant.id });
      const branch2 = await createTestBranch({ tenantId: testTenant.id });

      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await updateTenantUserService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
        newBranchIdsOptional: [branch1.id, branch2.id],
      });

      expect(result.branches.length).toBe(2);
    });

    it('should create audit log for role change', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await updateTenantUserService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
        newRoleIdOptional: ownerRole.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: user.id,
          entityType: 'USER',
          tenantId: testTenant.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      const roleRevoke = auditEntries.find((e) => e.action === 'ROLE_REVOKE');
      const roleAssign = auditEntries.find((e) => e.action === 'ROLE_ASSIGN');

      expect(roleRevoke).toBeDefined();
      expect(roleAssign).toBeDefined();
    });

    it('should prevent removing last OWNER', async () => {
      const ownerUser = await createTestUser();
      await createTestMembership({
        userId: ownerUser.id,
        tenantId: testTenant.id,
        roleId: ownerRole.id,
      });

      await expect(
        updateTenantUserService({
          currentTenantId: testTenant.id,
          currentUserId: actorUser.id,
          targetUserId: ownerUser.id,
          newRoleIdOptional: editorRole.id,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid role for tenant', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const otherTenant = await createTestTenant();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        permissionKeys: ['products:read'],
      });

      await expect(
        updateTenantUserService({
          currentTenantId: testTenant.id,
          currentUserId: actorUser.id,
          targetUserId: user.id,
          newRoleIdOptional: otherRole.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('removeUserFromTenantService - Archive Membership', () => {
    it('should archive user membership', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      expect(result.hasArchivedMembership).toBe(true);

      const membership = await prisma.userTenantMembership.findUnique({
        where: {
          userId_tenantId: { userId: user.id, tenantId: testTenant.id },
        },
      });

      expect(membership?.isArchived).toBe(true);
      expect(membership?.archivedByUserId).toBe(actorUser.id);
    });

    it('should create audit log for archival', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          entityId: user.id,
          entityType: 'USER',
          tenantId: testTenant.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.action).toBe('UPDATE');
    });

    it('should prevent removing last OWNER', async () => {
      const ownerUser = await createTestUser();
      await createTestMembership({
        userId: ownerUser.id,
        tenantId: testTenant.id,
        roleId: ownerRole.id,
      });

      await expect(
        removeUserFromTenantService({
          currentTenantId: testTenant.id,
          currentUserId: actorUser.id,
          targetUserId: ownerUser.id,
        })
      ).rejects.toThrow();
    });

    it('should prevent self-archival', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await expect(
        removeUserFromTenantService({
          currentTenantId: testTenant.id,
          currentUserId: user.id,
          targetUserId: user.id,
        })
      ).rejects.toThrow('Cannot archive own membership');
    });

    it('should be idempotent when already archived', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
      });

      const result = await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
      });

      expect(result.hasArchivedMembership).toBe(false);
    });
  });

  describe('restoreUserMembershipService - Restore Membership', () => {
    it('should restore archived membership', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
      });

      const result = await restoreUserMembershipService({
        currentTenantId: testTenant.id,
        targetUserId: user.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      expect(result.hasRestoredMembership).toBe(true);

      const membership = await prisma.userTenantMembership.findUnique({
        where: {
          userId_tenantId: { userId: user.id, tenantId: testTenant.id },
        },
      });

      expect(membership?.isArchived).toBe(false);
    });

    it('should create audit log for restoration', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await removeUserFromTenantService({
        currentTenantId: testTenant.id,
        currentUserId: actorUser.id,
        targetUserId: user.id,
      });

      await restoreUserMembershipService({
        currentTenantId: testTenant.id,
        targetUserId: user.id,
        auditContextOptional: { actorUserId: actorUser.id },
      });

      const auditEntries = await prisma.auditEvent.findMany({
        where: {
          entityId: user.id,
          entityType: 'USER',
          tenantId: testTenant.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      const restoreEntry = auditEntries[0];
      expect(restoreEntry?.action).toBe('UPDATE');
    });

    it('should be idempotent when not archived', async () => {
      const user = await createTestUser();
      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      const result = await restoreUserMembershipService({
        currentTenantId: testTenant.id,
        targetUserId: user.id,
      });

      expect(result.hasRestoredMembership).toBe(false);
    });
  });

  describe('User Can Belong to Multiple Tenants', () => {
    it('should allow user to be member of multiple tenants', async () => {
      const user = await createTestUser();
      const tenant2 = await createTestTenant();
      const tenant2Role = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['products:read'],
      });

      await createTestMembership({
        userId: user.id,
        tenantId: testTenant.id,
        roleId: editorRole.id,
      });

      await createTestMembership({
        userId: user.id,
        tenantId: tenant2.id,
        roleId: tenant2Role.id,
      });

      const memberships = await prisma.userTenantMembership.findMany({
        where: { userId: user.id },
      });

      expect(memberships.length).toBe(2);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should enforce tenant isolation across all operations', async () => {
      const tenant2 = await createTestTenant();
      const tenant2User = await createTestUser();
      const tenant2Role = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['products:read'],
      });

      await createTestMembership({
        userId: tenant2User.id,
        tenantId: tenant2.id,
        roleId: tenant2Role.id,
      });

      // Cannot get user from different tenant
      await expect(
        getUserForCurrentTenantService({
          currentTenantId: testTenant.id,
          targetUserId: tenant2User.id,
        })
      ).rejects.toThrow();

      // Cannot update user from different tenant
      await expect(
        updateTenantUserService({
          currentTenantId: testTenant.id,
          currentUserId: actorUser.id,
          targetUserId: tenant2User.id,
          newRoleIdOptional: editorRole.id,
        })
      ).rejects.toThrow();
    });
  });
});
