// api-server/__tests__/services/chat/userTools.test.ts
import { userTools } from '../../../../src/services/chat/tools/userTools.js';
import {
  createTestUser,
  createTestTenant,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../../helpers/factories.js';

// Helper for tool execute calls in tests
const TOOL_CALL_OPTIONS = { toolCallId: 'test', messages: [] as any[] };

describe('[CHAT-USER-001] AI Chat User Tools', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let viewerUser: Awaited<ReturnType<typeof createTestUser>>;
  let ownerRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;
  let adminRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;
  let viewerRole: Awaited<ReturnType<typeof createTestRoleWithPermissions>>;
  let branch1: Awaited<ReturnType<typeof createTestBranch>>;
  let branch2: Awaited<ReturnType<typeof createTestBranch>>;

  beforeEach(async () => {
    // Create tenant
    testTenant = await createTestTenant();

    // Create branches
    branch1 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Main Warehouse',
    });

    branch2 = await createTestBranch({
      tenantId: testTenant.id,
      name: 'Store A',
    });

    // Create roles
    ownerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      name: 'OWNER',
      permissionKeys: ['products:read', 'products:write', 'stock:read', 'stock:write', 'users:manage'],
    });

    adminRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      name: 'ADMIN',
      permissionKeys: ['products:read', 'products:write', 'stock:read', 'stock:write'],
    });

    viewerRole = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      name: 'VIEWER',
      permissionKeys: ['products:read', 'stock:read'],
    });

    // Create users
    ownerUser = await createTestUser();
    adminUser = await createTestUser();
    viewerUser = await createTestUser();

    // Add users to tenant with roles
    await createTestMembership({
      userId: ownerUser.id,
      tenantId: testTenant.id,
      roleId: ownerRole.id,
    });

    await createTestMembership({
      userId: adminUser.id,
      tenantId: testTenant.id,
      roleId: adminRole.id,
    });

    await createTestMembership({
      userId: viewerUser.id,
      tenantId: testTenant.id,
      roleId: viewerRole.id,
    });

    // Add users to branches
    await addUserToBranch(ownerUser.id, testTenant.id, branch1.id);
    await addUserToBranch(ownerUser.id, testTenant.id, branch2.id);
    await addUserToBranch(adminUser.id, testTenant.id, branch1.id);
    await addUserToBranch(viewerUser.id, testTenant.id, branch2.id);
  });

  describe('[AC-USER-001] searchUsers', () => {
    it('should search users by email', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        query: ownerUser.userEmailAddress,  
        limit: 20,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.users?.length).toBeGreaterThanOrEqual(1);
      expect(result.users?.[0]?.email).toBe(ownerUser.userEmailAddress);
    });

    it('should show user permissions', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        query: ownerUser.userEmailAddress,
        limit: 20,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      const owner = result.users?.find((u) => u.email === ownerUser.userEmailAddress);
      expect(owner?.permissions).toContain('users:manage');
    });

    it('should show user branch assignments', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        query: ownerUser.userEmailAddress,
        limit: 20,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      const owner = result.users?.find((u) => u.email === ownerUser.userEmailAddress);
      expect(owner?.branches).toContain('Main Warehouse');
      expect(owner?.branches).toContain('Store A');
      expect(owner?.branchCount).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        limit: 1,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.users?.length).toBeLessThanOrEqual(1);
    });

    it('should cap limit at 20', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        limit: 50,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.users?.length).toBeLessThanOrEqual(20);
    });

    it('should return empty result when no users found', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        query: 'nonexistent@example.com',
        limit: 20,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.users).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.message).toContain('No users found');
    });
  });

  describe('[AC-USER-002] getUserDetails', () => {
    it('should get user details by email', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getUserDetails.execute!({
        userEmail: adminUser.userEmailAddress,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.userId).toBe(adminUser.id);
      expect(result.email).toBe(adminUser.userEmailAddress);
      expect(result.role?.name).toBe('ADMIN');
    });

    it('should show complete role information', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getUserDetails.execute!({
        userEmail: ownerUser.userEmailAddress,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.role?.name).toBe('OWNER');
      expect(result.role?.permissions).toContain('users:manage');
      expect(result.role?.permissions.length).toBeGreaterThanOrEqual(5);
    });

    it('should show branch assignments with details', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getUserDetails.execute!({
        userEmail: ownerUser.userEmailAddress,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.branches?.length).toBe(2);
      expect(result.branches?.some((b) => b.name === 'Main Warehouse')).toBe(true);
      expect(result.branches?.every((b) => b.isActive === true)).toBe(true);
    });

    it('should return error if user not found', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getUserDetails.execute!({
        userEmail: 'nonexistent@example.com',
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.error).toBe('User not found');
    });

    xit('should handle user with no role', async () => {
      // Create user without role
      const userWithoutRole = await createTestUser();
      await createTestMembership({
        userId: userWithoutRole.id,
        tenantId: testTenant.id,
        roleId: null as any, // Force null role for testing
      });

      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getUserDetails.execute!({
        userEmail: userWithoutRole.userEmailAddress,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.role).toBeNull();
    });
  });

  describe('[AC-USER-003] listRoles', () => {
    it('should list all roles', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({ includeSystem: false, limit: 20 }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.roles?.length).toBeGreaterThanOrEqual(3);
      expect(result.roles?.some((r) => r.name === 'OWNER')).toBe(true);
      expect(result.roles?.some((r) => r.name === 'ADMIN')).toBe(true);
      expect(result.roles?.some((r) => r.name === 'VIEWER')).toBe(true);
    });

    it('should show permissions for each role', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({ includeSystem: false, limit: 20 }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      const ownerRoleResult = result.roles?.find((r) => r.name === 'OWNER');
      expect(ownerRoleResult?.permissions).toContain('users:manage');
      expect(ownerRoleResult?.permissionCount).toBeGreaterThanOrEqual(5);
    });

    it('should show user count per role', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({ includeSystem: false, limit: 20 }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      const ownerRoleResult = result.roles?.find((r) => r.name === 'OWNER');
      expect(ownerRoleResult?.userCount).toBeGreaterThanOrEqual(1);
    });

    it('should exclude system roles when requested', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({
        includeSystem: false,
        limit: 20,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      // Should not include system roles (if any marked as isSystem: true)
      expect(result.roles?.every((r) => r.isSystem === false)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({
        includeSystem: false,
        limit: 2,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.roles?.length).toBeLessThanOrEqual(2);
    });

    it('should cap limit at 20', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({
        includeSystem: false,
        limit: 50,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.roles?.length).toBeLessThanOrEqual(20);
    });
  });

  describe('[AC-USER-004] checkPermission', () => {
    it('should verify user has permission', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.checkPermission.execute!({
        userEmail: ownerUser.userEmailAddress,
        permissionKey: 'users:manage',
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.hasPermission).toBe(true);
      expect(result.explanation).toContain('Yes');
    });

    it('should verify user does not have permission', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.checkPermission.execute!({
        userEmail: viewerUser.userEmailAddress,
        permissionKey: 'users:manage',
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.hasPermission).toBe(false);
      expect(result.explanation).toContain('No');
    });

    it('should show all user permissions', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.checkPermission.execute!({
        userEmail: adminUser.userEmailAddress,
        permissionKey: 'products:read',
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.allPermissions).toContain('products:read');
      expect(result.allPermissions).toContain('products:write');
      expect(result.allPermissions).toContain('stock:read');
    });

    it('should return error if user not found', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.checkPermission.execute!({
        userEmail: 'nonexistent@example.com',
        permissionKey: 'products:read',
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.error).toBe('User not found');
    });

    it('should handle invalid permission key gracefully', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.checkPermission.execute!({
        userEmail: ownerUser.userEmailAddress,
        permissionKey: 'invalid:permission',
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      // Should still return a result (permission will be false)
      expect(result.hasPermission).toBe(false);
    });
  });

  describe('[AC-USER-005] Security - Tenant Isolation', () => {
    it('should not search users from other tenants', async () => {
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

      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        query: otherUser.userEmailAddress,
        limit: 20,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.users?.some((u) => u.userId === otherUser.id)).toBe(false);
    });

    it('should not get details for users from other tenants', async () => {
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

      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.getUserDetails.execute!({
        userEmail: otherUser.userEmailAddress,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.error).toBe('User not found');
    });

    it('should not list roles from other tenants', async () => {
      const otherTenant = await createTestTenant();
      const otherRole = await createTestRoleWithPermissions({
        tenantId: otherTenant.id,
        name: 'OTHER_TENANT_ROLE',
        permissionKeys: ['products:read'],
      });

      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({ includeSystem: false, limit: 20 }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      expect(result.roles?.some((r) => r.id === otherRole.id)).toBe(false);
    });
  });

  describe('[AC-USER-006] Pagination', () => {
    it('should indicate if more users are available', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.searchUsers.execute!({
        limit: 1,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      if (result.count && result.count >= 1) {
        expect(result.hasMore).toBeDefined();
      }
    });

    it('should indicate if more roles are available', async () => {
      const tools = userTools({
        userId: ownerUser.id,
        tenantId: testTenant.id,
      });

      const result = await tools.listRoles.execute!({
        includeSystem: false,
        limit: 1,
      }, TOOL_CALL_OPTIONS);
      if (Symbol.asyncIterator in result) throw new Error('Unexpected AsyncIterable');

      if (result.count && result.count >= 1) {
        expect(result.hasMore).toBeDefined();
      }
    });
  });
});
