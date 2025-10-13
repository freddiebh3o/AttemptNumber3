/**
 * Test Context - Tracks entities created during tests for cleanup
 *
 * This allows tests to run against the dev database without interfering
 * with manually created seed data. Each test tracks what it creates and
 * only cleans up its own data.
 */

import { prismaClientInstance as prisma } from '../../src/db/prismaClient.js';

interface TestContext {
  createdIds: {
    users: string[];
    tenants: string[];
    roles: string[];
    products: string[];
    branches: string[];
    memberships: string[];
    branchMemberships: string[];
    stockLots: string[];
    stockTransfers: string[];
    stockTransferItems: string[];
    transferTemplates: string[];
    transferTemplateItems: string[];
    approvalRules: string[];
    approvalConditions: string[];
    approvalLevels: string[];
    approvalRecords: string[];
  };
}

let currentContext: TestContext | null = null;

/**
 * Initialize a new test context
 * Call this in beforeEach
 */
export function initTestContext(): TestContext {
  currentContext = {
    createdIds: {
      users: [],
      tenants: [],
      roles: [],
      products: [],
      branches: [],
      memberships: [],
      branchMemberships: [],
      stockLots: [],
      stockTransfers: [],
      stockTransferItems: [],
      transferTemplates: [],
      transferTemplateItems: [],
      approvalRules: [],
      approvalConditions: [],
      approvalLevels: [],
      approvalRecords: [],
    },
  };
  return currentContext;
}

/**
 * Get the current test context
 */
export function getTestContext(): TestContext {
  if (!currentContext) {
    throw new Error('Test context not initialized. Call initTestContext() in beforeEach');
  }
  return currentContext;
}

/**
 * Track a created entity for cleanup
 */
export function trackCreated(type: keyof TestContext['createdIds'], id: string) {
  const context = getTestContext();
  context.createdIds[type].push(id);
}

/**
 * Clean up all entities created during this test
 * Call this in afterEach
 */
export async function cleanupTestContext() {
  if (!currentContext) {
    return; // Nothing to clean up
  }

  const { createdIds } = currentContext;

  try {
    // Delete in correct order to respect foreign key constraints

    // Approval records first
    if (createdIds.approvalRecords.length > 0) {
      await prisma.transferApprovalRecord.deleteMany({
        where: { id: { in: createdIds.approvalRecords } },
      });
    }

    // Stock transfer items before transfers
    if (createdIds.stockTransferItems.length > 0) {
      await prisma.stockTransferItem.deleteMany({
        where: { id: { in: createdIds.stockTransferItems } },
      });
    }

    // Stock transfers
    if (createdIds.stockTransfers.length > 0) {
      await prisma.stockTransfer.deleteMany({
        where: { id: { in: createdIds.stockTransfers } },
      });
    }

    // Transfer template items before templates
    if (createdIds.transferTemplateItems.length > 0) {
      await prisma.stockTransferTemplateItem.deleteMany({
        where: { id: { in: createdIds.transferTemplateItems } },
      });
    }

    // Transfer templates
    if (createdIds.transferTemplates.length > 0) {
      await prisma.stockTransferTemplate.deleteMany({
        where: { id: { in: createdIds.transferTemplates } },
      });
    }

    // Stock lots and ledger
    if (createdIds.stockLots.length > 0) {
      await prisma.stockLot.deleteMany({
        where: { id: { in: createdIds.stockLots } },
      });
    }

    // Product stock (no IDs tracked, clean by product/branch)
    if (createdIds.products.length > 0 || createdIds.branches.length > 0) {
      await prisma.productStock.deleteMany({
        where: {
          OR: [
            { productId: { in: createdIds.products } },
            { branchId: { in: createdIds.branches } },
          ],
        },
      });
    }

    // Stock ledger (no IDs tracked, clean by product/branch)
    if (createdIds.products.length > 0 || createdIds.branches.length > 0) {
      await prisma.stockLedger.deleteMany({
        where: {
          OR: [
            { productId: { in: createdIds.products } },
            { branchId: { in: createdIds.branches } },
          ],
        },
      });
    }

    // Products
    if (createdIds.products.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: createdIds.products } },
      });
    }

    // Branch memberships
    if (createdIds.branchMemberships.length > 0) {
      await prisma.userBranchMembership.deleteMany({
        where: { id: { in: createdIds.branchMemberships } },
      });
    }

    // Branches
    if (createdIds.branches.length > 0) {
      await prisma.branch.deleteMany({
        where: { id: { in: createdIds.branches } },
      });
    }

    // Approval levels and conditions
    if (createdIds.approvalLevels.length > 0) {
      await prisma.transferApprovalLevel.deleteMany({
        where: { id: { in: createdIds.approvalLevels } },
      });
    }
    if (createdIds.approvalConditions.length > 0) {
      await prisma.transferApprovalCondition.deleteMany({
        where: { id: { in: createdIds.approvalConditions } },
      });
    }

    // Approval rules
    if (createdIds.approvalRules.length > 0) {
      await prisma.transferApprovalRule.deleteMany({
        where: { id: { in: createdIds.approvalRules } },
      });
    }

    // Tenant memberships
    if (createdIds.memberships.length > 0) {
      await prisma.userTenantMembership.deleteMany({
        where: { id: { in: createdIds.memberships } },
      });
    }

    // Role permissions
    if (createdIds.roles.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: { in: createdIds.roles } },
      });
    }

    // Roles
    if (createdIds.roles.length > 0) {
      await prisma.role.deleteMany({
        where: { id: { in: createdIds.roles } },
      });
    }

    // Tenant branding
    if (createdIds.tenants.length > 0) {
      await prisma.tenantBranding.deleteMany({
        where: { tenantId: { in: createdIds.tenants } },
      });
    }

    // Tenants
    if (createdIds.tenants.length > 0) {
      await prisma.tenant.deleteMany({
        where: { id: { in: createdIds.tenants } },
      });
    }

    // Users
    if (createdIds.users.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdIds.users } },
      });
    }

    // Audit events for test entities
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { entityId: { in: [...createdIds.products, ...createdIds.tenants, ...createdIds.stockTransfers] } },
        ],
      },
    });

  } catch (error) {
    console.error('Error cleaning up test context:', error);
    throw error;
  } finally {
    currentContext = null;
  }
}

/**
 * Helper to run cleanup even if test fails
 */
export function setupTestContextHooks() {
  beforeEach(() => {
    initTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext();
  });
}
