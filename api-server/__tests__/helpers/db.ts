/**
 * Database test utilities
 *
 * Tests run against your development database using timestamp-based unique data.
 * Each test creates entities with Date.now() timestamps to ensure uniqueness.
 *
 * This means:
 * - Tests don't interfere with your seed data
 * - Tests don't interfere with each other
 * - You can login to dev after running tests
 * - No database cleanup needed
 *
 * Over time, test data will accumulate. To clean up, re-run your seed:
 *   npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

export { prisma };
