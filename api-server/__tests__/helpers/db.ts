/**
 * Database test utilities
 * Provides helpers for seeding test data and cleaning up after tests
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean all data from test database
 * IMPORTANT: Only use in test environment!
 */
export async function cleanDatabase() {
  // Delete in correct order to respect foreign key constraints
  await prisma.apiRequestLog.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.stockLot.deleteMany();
  await prisma.productStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.userBranchMembership.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.userTenantMembership.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.tenantBranding.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  // Permissions are global and should not be deleted
}

/**
 * Reset database sequences/auto-increment counters
 */
export async function resetSequences() {
  // PostgreSQL specific - reset sequences for auto-increment IDs
  // This ensures predictable IDs in tests
  const tables = [
    'User',
    'Tenant',
    'Role',
    'Product',
    'Branch',
    'StockLot',
    'ProductStock',
    'StockLedger',
    'AuditEvent',
    'ApiRequestLog',
    'IdempotencyRecord',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER SEQUENCE "${table}_id_seq" RESTART WITH 1;`
      );
    } catch (error) {
      // Sequence might not exist for this table, skip
      console.warn(`Could not reset sequence for ${table}:`, error);
    }
  }
}

/**
 * Get a fresh Prisma client for tests
 */
export function getPrismaClient() {
  return prisma;
}

/**
 * Disconnect Prisma client (call in afterAll)
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

/**
 * Setup function to run before all tests
 */
export async function setupTestDatabase() {
  await cleanDatabase();
  await resetSequences();
}

/**
 * Teardown function to run after all tests
 */
export async function teardownTestDatabase() {
  await cleanDatabase();
  await disconnectPrisma();
}

export { prisma };
