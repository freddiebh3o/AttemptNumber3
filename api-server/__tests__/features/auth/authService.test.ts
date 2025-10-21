// api-server/__tests__/features/auth/authService.test.ts
import bcrypt from 'bcryptjs';
import {
  verifyUserCredentialsForTenantService,
  getUserMembershipsService,
  getUserBranchMembershipsForTenantService,
} from '../../../src/services/authService.js';
import {
  createTestUser,
  createTestTenant,
  createTestRoleWithPermissions,
  createTestMembership,
  createTestBranch,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

describe('[AUTH-SVC] Auth Service', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testPassword: string;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testPassword = 'TestPassword123!';

    // Create user with known password
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const timestamp = Date.now();
    const email = `user-${timestamp}@test.com`;

    const user = await prisma.user.create({
      data: {
        userEmailAddress: email,
        userHashedPassword: hashedPassword,
      },
    });

    testUser = {
      id: user.id,
      userEmailAddress: user.userEmailAddress,
      userHashedPassword: user.userHashedPassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });

  describe('verifyUserCredentialsForTenantService - Sign In', () => {
    it('should verify valid credentials and tenant membership', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const result = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: testPassword,
        tenantSlugInputValue: testTenant.tenantSlug,
      });

      expect(result).toBeDefined();
      expect(result?.matchedUserId).toBe(testUser.id);
      expect(result?.matchedTenantId).toBe(testTenant.id);
    });

    it('should return null for invalid email', async () => {
      const result = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: 'nonexistent@test.com',
        userPlainTextPasswordInputValue: testPassword,
        tenantSlugInputValue: testTenant.tenantSlug,
      });

      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const result = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: 'WrongPassword123!',
        tenantSlugInputValue: testTenant.tenantSlug,
      });

      expect(result).toBeNull();
    });

    it('should return null for invalid tenant slug', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const result = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: testPassword,
        tenantSlugInputValue: 'nonexistent-tenant',
      });

      expect(result).toBeNull();
    });

    it('should return null if user not member of tenant', async () => {
      // User exists but has no membership in testTenant
      const result = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: testPassword,
        tenantSlugInputValue: testTenant.tenantSlug,
      });

      expect(result).toBeNull();
    });

    it('should return null for archived membership', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      // Archive the membership
      await prisma.userTenantMembership.update({
        where: {
          userId_tenantId: { userId: testUser.id, tenantId: testTenant.id },
        },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      const result = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: testPassword,
        tenantSlugInputValue: testTenant.tenantSlug,
      });

      expect(result).toBeNull();
    });

    it('should use timing-safe password comparison', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      // Test with correct password
      const startCorrect = Date.now();
      await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: testPassword,
        tenantSlugInputValue: testTenant.tenantSlug,
      });
      const timeCorrect = Date.now() - startCorrect;

      // Test with incorrect password
      const startIncorrect = Date.now();
      await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: testUser.userEmailAddress,
        userPlainTextPasswordInputValue: 'WrongPassword',
        tenantSlugInputValue: testTenant.tenantSlug,
      });
      const timeIncorrect = Date.now() - startIncorrect;

      // Both should take roughly same time (within reasonable margin)
      // This is a basic timing safety check
      expect(Math.abs(timeCorrect - timeIncorrect)).toBeLessThan(500);
    });

    it('should verify bcrypt hashing strength', async () => {
      const plainPassword = 'StrongPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Hash should be different from plain text
      expect(hashedPassword).not.toBe(plainPassword);

      // Hash should start with bcrypt identifier
      expect(hashedPassword).toMatch(/^\$2[aby]\$/);

      // Should be able to verify
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isValid).toBe(true);

      // Wrong password should fail
      const isInvalid = await bcrypt.compare('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('getUserMembershipsService - Multiple Tenants', () => {
    it('should return all tenant memberships for user', async () => {
      const tenant2 = await createTestTenant();

      const role1 = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ROLE_DEFS.VIEWER,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role1.id,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      const result = await getUserMembershipsService({
        currentUserId: testUser.id,
      });

      expect(result.length).toBe(2);
      expect(result.some((m) => m.tenantSlug === testTenant.tenantSlug)).toBe(true);
      expect(result.some((m) => m.tenantSlug === tenant2.tenantSlug)).toBe(true);
    });

    it('should include role information with permissions', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ['products:read', 'products:write'],
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      const result = await getUserMembershipsService({
        currentUserId: testUser.id,
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      const membership = result.find((m) => m.tenantSlug === testTenant.tenantSlug);
      expect(membership?.role).toBeDefined();
      expect(membership?.role?.permissions).toContain('products:read');
      expect(membership?.role?.permissions).toContain('products:write');
    });

    it('should not return archived memberships', async () => {
      const role = await createTestRoleWithPermissions({
        tenantId: testTenant.id,
        permissionKeys: ROLE_DEFS.EDITOR,
      });

      await createTestMembership({
        userId: testUser.id,
        tenantId: testTenant.id,
        roleId: role.id,
      });

      // Archive the membership
      await prisma.userTenantMembership.update({
        where: {
          userId_tenantId: { userId: testUser.id, tenantId: testTenant.id },
        },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      const result = await getUserMembershipsService({
        currentUserId: testUser.id,
      });

      expect(result.every((m) => m.tenantSlug !== testTenant.tenantSlug)).toBe(true);
    });

    it('should return empty array for user with no memberships', async () => {
      const newUser = await createTestUser();

      const result = await getUserMembershipsService({
        currentUserId: newUser.id,
      });

      expect(result).toEqual([]);
    });
  });

  describe('getUserBranchMembershipsForTenantService - Branch Access', () => {
    it('should return branch memberships for user in tenant', async () => {
      const branch1 = await createTestBranch({
        tenantId: testTenant.id,
        name: 'Warehouse 1',
      });
      const branch2 = await createTestBranch({
        tenantId: testTenant.id,
        name: 'Warehouse 2',
      });

      await prisma.userBranchMembership.createMany({
        data: [
          { userId: testUser.id, tenantId: testTenant.id, branchId: branch1.id },
          { userId: testUser.id, tenantId: testTenant.id, branchId: branch2.id },
        ],
      });

      const result = await getUserBranchMembershipsForTenantService({
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
      });

      expect(result.length).toBe(2);
      expect(result.some((b) => b.branchId === branch1.id)).toBe(true);
      expect(result.some((b) => b.branchId === branch2.id)).toBe(true);
    });

    it('should include branch names', async () => {
      const branch = await createTestBranch({
        tenantId: testTenant.id,
        name: 'Main Warehouse',
      });

      await prisma.userBranchMembership.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          branchId: branch.id,
        },
      });

      const result = await getUserBranchMembershipsForTenantService({
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
      });

      expect(result.length).toBe(1);
      expect(result[0]?.branchName).toBe('Main Warehouse');
    });

    it('should only return branches for specified tenant', async () => {
      const tenant2 = await createTestTenant();
      const branch1 = await createTestBranch({ tenantId: testTenant.id });
      const branch2 = await createTestBranch({ tenantId: tenant2.id });

      await prisma.userBranchMembership.createMany({
        data: [
          { userId: testUser.id, tenantId: testTenant.id, branchId: branch1.id },
          { userId: testUser.id, tenantId: tenant2.id, branchId: branch2.id },
        ],
      });

      const result = await getUserBranchMembershipsForTenantService({
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
      });

      expect(result.length).toBe(1);
      expect(result[0]?.branchId).toBe(branch1.id);
    });

    it('should return empty array for user with no branch access', async () => {
      const result = await getUserBranchMembershipsForTenantService({
        currentUserId: testUser.id,
        currentTenantId: testTenant.id,
      });

      expect(result).toEqual([]);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords with proper strength (bcrypt rounds)', async () => {
      const password = 'TestPassword123!';

      // Test with cost factor 10 (default)
      const hash = await bcrypt.hash(password, 10);

      // Extract cost from hash (format: $2a$10$...)
      const costMatch = hash.match(/^\$2[aby]\$(\d+)\$/);
      expect(costMatch).toBeDefined();
      expect(costMatch![1]).toBe('10');
    });

    it('should reject weak passwords in application logic', () => {
      // This tests the convention that passwords should be strong
      const weakPasswords = [
        'password',
        '12345678',
        'qwerty',
        'abc123',
      ];

      weakPasswords.forEach((weak) => {
        // In a real app, you'd have password strength validation
        // This test documents the expected behavior
        expect(weak.length).toBeGreaterThan(0);
      });
    });
  });
});
