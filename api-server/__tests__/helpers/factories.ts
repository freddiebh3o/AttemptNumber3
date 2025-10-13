/**
 * Test data factories
 * Create test entities with sensible defaults
 */

import { PrismaClient } from '@prisma/client';
import type { User, Tenant, Role, Product, Branch, TransferApprovalRule } from '@prisma/client';
import type { ApprovalRuleConditionType, ApprovalMode } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface CreateUserOptions {
  email?: string;
  password?: string;
}

interface CreateTenantOptions {
  name?: string;
  slug?: string;
}

interface CreateRoleOptions {
  name?: string;
  tenantId: string;
  permissionIds?: string[];
  isSystem?: boolean;
}

interface CreateProductOptions {
  name?: string;
  sku?: string;
  tenantId: string;
  pricePence?: number;
}

interface CreateBranchOptions {
  name?: string;
  slug?: string;
  tenantId: string;
}

/**
 * Create a test user with hashed password
 */
export async function createTestUser(
  options: CreateUserOptions = {}
): Promise<User> {
  const email = options.email || `test-${Date.now()}@example.com`;
  const password = options.password || 'password123';

  const passwordHash = await bcrypt.hash(password, 10);

  return await prisma.user.create({
    data: {
      userEmailAddress: email,
      userHashedPassword: passwordHash,
    },
  });
}

/**
 * Create a test tenant
 */
export async function createTestTenant(
  options: CreateTenantOptions = {}
): Promise<Tenant> {
  const timestamp = Date.now();
  const name = options.name || `Test Tenant ${timestamp}`;
  const slug = options.slug || `test-tenant-${timestamp}`;

  return await prisma.tenant.create({
    data: {
      tenantName: name,
      tenantSlug: slug,
    },
  });
}

/**
 * Create a test role with permissions
 */
export async function createTestRole(
  options: CreateRoleOptions
): Promise<Role> {
  const name = options.name || `Test Role ${Date.now()}`;
  const { tenantId, permissionIds = [], isSystem = false } = options;

  const role = await prisma.role.create({
    data: {
      name,
      description: `Test role for testing purposes`,
      isSystem,
      tenantId,
    },
  });

  // Assign permissions if provided
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
    });
  }

  return role;
}

/**
 * Create a test role with permissions by permission keys (more convenient)
 */
export async function createTestRoleWithPermissions(params: {
  name?: string;
  tenantId: string;
  permissionKeys: readonly string[];
  isSystem?: boolean;
}): Promise<Role> {
  const name = params.name || `Test Role ${Date.now()}`;
  const { tenantId, permissionKeys, isSystem = false } = params;

  // Get permission IDs from keys
  const permissions = await getPermissionsByKeys([...permissionKeys]);
  const permissionIds = permissions.map((p) => p.id);

  return await createTestRole({
    name,
    tenantId,
    permissionIds,
    isSystem,
  });
}

/**
 * Create a test product
 */
export async function createTestProduct(
  options: CreateProductOptions
): Promise<Product> {
  const timestamp = Date.now();
  const name = options.name || `Test Product ${timestamp}`;
  const sku = options.sku || `TEST-SKU-${timestamp}`;
  const { tenantId } = options;

  return await prisma.product.create({
    data: {
      productName: name,
      productSku: sku,
      productPricePence: options.pricePence || 1000, // Default £10.00
      tenantId,
      entityVersion: 1,
    },
  });
}

/**
 * Create a test branch
 */
export async function createTestBranch(
  options: CreateBranchOptions
): Promise<Branch> {
  const timestamp = Date.now();
  const name = options.name || `Test Branch ${timestamp}`;
  const slug = options.slug || `test-branch-${timestamp}`;
  const { tenantId } = options;

  return await prisma.branch.create({
    data: {
      branchName: name,
      branchSlug: slug,
      tenantId,
      isActive: true,
    },
  });
}

/**
 * Add user to tenant with a specific role
 */
export async function addUserToTenant(
  userId: string,
  tenantId: string,
  roleId: string
) {
  return await prisma.userTenantMembership.create({
    data: {
      userId,
      tenantId,
      roleId,
    },
  });
}

/**
 * Create a test membership (alias for addUserToTenant for consistency)
 */
export async function createTestMembership(params: {
  userId: string;
  tenantId: string;
  roleId: string;
}) {
  return await addUserToTenant(params.userId, params.tenantId, params.roleId);
}

/**
 * Add user to branch
 */
export async function addUserToBranch(
  userId: string,
  tenantId: string,
  branchId: string
) {
  return await prisma.userBranchMembership.create({
    data: {
      userId,
      tenantId,
      branchId,
    },
  });
}

/**
 * Get permission by key
 */
export async function getPermissionByKey(key: string) {
  return await prisma.permission.findUnique({
    where: { key },
  });
}

/**
 * Get multiple permissions by keys
 */
export async function getPermissionsByKeys(keys: string[]) {
  return await prisma.permission.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });
}

/**
 * Create a complete test scenario:
 * - Tenant
 * - User
 * - Role with permissions
 * - User membership in tenant
 */
export async function createTestScenario(options: {
  permissionKeys?: string[];
  userEmail?: string;
  tenantSlug?: string;
}) {
  const tenant = await createTestTenant(
    options.tenantSlug ? { slug: options.tenantSlug } : {}
  );

  const user = await createTestUser(
    options.userEmail ? { email: options.userEmail } : {}
  );

  let permissions: { id: string }[] = [];
  if (options.permissionKeys && options.permissionKeys.length > 0) {
    permissions = await getPermissionsByKeys(options.permissionKeys);
  }

  const role = await createTestRole({
    name: 'Test Role',
    tenantId: tenant.id,
    permissionIds: permissions.map((p) => p.id),
  });

  const membership = await addUserToTenant(user.id, tenant.id, role.id);

  return {
    tenant,
    user,
    role,
    membership,
    permissions,
  };
}

/**
 * Create a test approval rule with conditions and levels
 */
export async function createTestApprovalRule(options: {
  tenantId: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  approvalMode?: ApprovalMode;
  priority?: number;
  conditions?: Array<{
    conditionType: ApprovalRuleConditionType;
    threshold?: number;
    branchId?: string;
  }>;
  levels?: Array<{
    level: number;
    name: string;
    requiredRoleId?: string;
    requiredUserId?: string;
  }>;
}): Promise<TransferApprovalRule> {
  const timestamp = Date.now();
  const name = options.name || `Test Approval Rule ${timestamp}`;
  const description = options.description;
  const isActive = options.isActive !== undefined ? options.isActive : true;
  const approvalMode = options.approvalMode || 'SEQUENTIAL';
  const priority = options.priority || 1;
  const { tenantId } = options;

  // Create the rule
  const rule = await prisma.transferApprovalRule.create({
    data: {
      tenantId,
      name,
      description,
      isActive,
      approvalMode,
      priority,
    },
  });

  // Create conditions if provided
  if (options.conditions && options.conditions.length > 0) {
    await prisma.transferApprovalCondition.createMany({
      data: options.conditions.map((condition) => ({
        ruleId: rule.id,
        conditionType: condition.conditionType,
        threshold: condition.threshold,
        branchId: condition.branchId,
      })),
    });
  }

  // Create levels if provided
  if (options.levels && options.levels.length > 0) {
    await prisma.transferApprovalLevel.createMany({
      data: options.levels.map((level) => ({
        ruleId: rule.id,
        level: level.level,
        name: level.name,
        requiredRoleId: level.requiredRoleId,
        requiredUserId: level.requiredUserId,
      })),
    });
  }

  return rule;
}

/**
 * Create a simple quantity-based approval rule
 */
export async function createTestQuantityApprovalRule(params: {
  tenantId: string;
  threshold: number;
  approvalLevels: Array<{
    level: number;
    name: string;
    requiredRoleId?: string;
    requiredUserId?: string;
  }>;
  name?: string;
  isActive?: boolean;
}): Promise<TransferApprovalRule> {
  return await createTestApprovalRule({
    tenantId: params.tenantId,
    name: params.name || `Quantity Rule (>${params.threshold} units) ${Date.now()}`,
    isActive: params.isActive !== undefined ? params.isActive : true,
    approvalMode: 'SEQUENTIAL',
    priority: 1,
    conditions: [
      {
        conditionType: 'QUANTITY_THRESHOLD',
        threshold: params.threshold,
      },
    ],
    levels: params.approvalLevels,
  });
}

/**
 * Create a simple value-based approval rule
 */
export async function createTestValueApprovalRule(params: {
  tenantId: string;
  thresholdPence: number;
  approvalLevels: Array<{
    level: number;
    name: string;
    requiredRoleId?: string;
    requiredUserId?: string;
  }>;
  name?: string;
  isActive?: boolean;
}): Promise<TransferApprovalRule> {
  return await createTestApprovalRule({
    tenantId: params.tenantId,
    name: params.name || `Value Rule (>£${params.thresholdPence / 100}) ${Date.now()}`,
    isActive: params.isActive !== undefined ? params.isActive : true,
    approvalMode: 'SEQUENTIAL',
    priority: 1,
    conditions: [
      {
        conditionType: 'VALUE_THRESHOLD',
        threshold: params.thresholdPence,
      },
    ],
    levels: params.approvalLevels,
  });
}

/**
 * Create a branch-specific approval rule
 */
export async function createTestBranchApprovalRule(params: {
  tenantId: string;
  branchId: string;
  approvalLevels: Array<{
    level: number;
    name: string;
    requiredRoleId?: string;
    requiredUserId?: string;
  }>;
  name?: string;
  isActive?: boolean;
}): Promise<TransferApprovalRule> {
  return await createTestApprovalRule({
    tenantId: params.tenantId,
    name: params.name || `Branch Rule ${Date.now()}`,
    isActive: params.isActive !== undefined ? params.isActive : true,
    approvalMode: 'SEQUENTIAL',
    priority: 1,
    conditions: [
      {
        conditionType: 'BRANCH_SOURCE',
        branchId: params.branchId,
      },
    ],
    levels: params.approvalLevels,
  });
}
