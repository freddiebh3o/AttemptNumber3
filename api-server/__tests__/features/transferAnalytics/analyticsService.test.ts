/**
 * Transfer Analytics Service Tests
 * Tests for analytics calculation functions
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { PrismaClient, StockTransferStatus, TransferPriority } from '@prisma/client';
import {
  getOverviewMetrics,
  getVolumeChartData,
  getBranchDependencies,
  getTopRoutes,
  getStatusDistribution,
  getBottlenecks,
  getProductFrequency,
} from '../../../src/services/analytics/transferAnalyticsService.js';
import {
  createTestTenant,
  createTestUser,
  createTestBranch,
  createTestProduct,
  createTestRoleWithPermissions,
  addUserToTenant,
  addUserToBranch,
} from '../../helpers/factories.js';
import { ROLE_DEFS } from '../../../src/rbac/catalog.js';

const prisma = new PrismaClient();

describe('Transfer Analytics Service', () => {
  let tenantId: string;
  let userId: string;
  let warehouseBranchId: string;
  let retailBranchId: string;
  let hqBranchId: string;
  let productAId: string;
  let productBId: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Create test user with OWNER role
    const user = await createTestUser();
    userId = user.id;

    const role = await createTestRoleWithPermissions({
      tenantId,
      permissionKeys: ROLE_DEFS.OWNER,
    });
    await addUserToTenant(userId, tenantId, role.id);

    // Create 3 branches
    const warehouse = await createTestBranch({ tenantId, name: 'Warehouse' });
    warehouseBranchId = warehouse.id;
    await addUserToBranch(userId, tenantId, warehouseBranchId);

    const retail = await createTestBranch({ tenantId, name: 'Retail' });
    retailBranchId = retail.id;
    await addUserToBranch(userId, tenantId, retailBranchId);

    const hq = await createTestBranch({ tenantId, name: 'HQ' });
    hqBranchId = hq.id;
    await addUserToBranch(userId, tenantId, hqBranchId);

    // Create 2 products
    const productA = await createTestProduct({ tenantId, name: 'Product A', pricePence: 500 });
    productAId = productA.id;

    const productB = await createTestProduct({ tenantId, name: 'Product B', pricePence: 800 });
    productBId = productB.id;

    // Create sample transfers with varying statuses, priorities, and dates
    const now = new Date();
    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    // Transfer 1: Warehouse → Retail (COMPLETED)
    await prisma.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: `TRF-${Date.now()}-1`,
        sourceBranchId: warehouseBranchId,
        destinationBranchId: retailBranchId,
        requestedByUserId: userId,
        status: StockTransferStatus.COMPLETED,
        priority: TransferPriority.NORMAL,
        requestedAt: fourDaysAgo,
        reviewedAt: new Date(fourDaysAgo.getTime() + 3600 * 1000), // 1 hour later
        shippedAt: new Date(fourDaysAgo.getTime() + 7200 * 1000), // 2 hours later
        completedAt: new Date(fourDaysAgo.getTime() + 10800 * 1000), // 3 hours later
        items: {
          create: [
            { productId: productAId, qtyRequested: 10, qtyApproved: 10, qtyShipped: 10, qtyReceived: 10 },
            { productId: productBId, qtyRequested: 5, qtyApproved: 5, qtyShipped: 5, qtyReceived: 5 },
          ],
        },
      },
    });

    // Transfer 2: Warehouse → HQ (COMPLETED)
    await prisma.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: `TRF-${Date.now()}-2`,
        sourceBranchId: warehouseBranchId,
        destinationBranchId: hqBranchId,
        requestedByUserId: userId,
        status: StockTransferStatus.COMPLETED,
        priority: TransferPriority.HIGH,
        requestedAt: threeDaysAgo,
        reviewedAt: new Date(threeDaysAgo.getTime() + 1800 * 1000), // 30 min
        shippedAt: new Date(threeDaysAgo.getTime() + 5400 * 1000), // 1.5 hours
        completedAt: new Date(threeDaysAgo.getTime() + 9000 * 1000), // 2.5 hours
        items: {
          create: [
            { productId: productAId, qtyRequested: 20, qtyApproved: 20, qtyShipped: 20, qtyReceived: 20 },
          ],
        },
      },
    });

    // Transfer 3: Retail → HQ (IN_TRANSIT)
    await prisma.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: `TRF-${Date.now()}-3`,
        sourceBranchId: retailBranchId,
        destinationBranchId: hqBranchId,
        requestedByUserId: userId,
        status: StockTransferStatus.IN_TRANSIT,
        priority: TransferPriority.URGENT,
        requestedAt: twoDaysAgo,
        reviewedAt: new Date(twoDaysAgo.getTime() + 900 * 1000), // 15 min
        shippedAt: new Date(twoDaysAgo.getTime() + 2700 * 1000), // 45 min
        items: {
          create: [
            { productId: productBId, qtyRequested: 8, qtyApproved: 8, qtyShipped: 8, qtyReceived: 0 },
          ],
        },
      },
    });

    // Transfer 4: Warehouse → Retail (APPROVED)
    await prisma.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: `TRF-${Date.now()}-4`,
        sourceBranchId: warehouseBranchId,
        destinationBranchId: retailBranchId,
        requestedByUserId: userId,
        status: StockTransferStatus.APPROVED,
        priority: TransferPriority.NORMAL,
        requestedAt: yesterday,
        reviewedAt: new Date(yesterday.getTime() + 7200 * 1000), // 2 hours
        items: {
          create: [
            { productId: productAId, qtyRequested: 15, qtyApproved: 15, qtyShipped: 0, qtyReceived: 0 },
          ],
        },
      },
    });

    // Transfer 5: Retail → Warehouse (REQUESTED)
    await prisma.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: `TRF-${Date.now()}-5`,
        sourceBranchId: retailBranchId,
        destinationBranchId: warehouseBranchId,
        requestedByUserId: userId,
        status: StockTransferStatus.REQUESTED,
        priority: TransferPriority.LOW,
        requestedAt: now,
        items: {
          create: [
            { productId: productBId, qtyRequested: 12, qtyApproved: null, qtyShipped: 0, qtyReceived: 0 },
          ],
        },
      },
    });

    // Transfer 6: Warehouse → Retail (REJECTED)
    await prisma.stockTransfer.create({
      data: {
        tenantId,
        transferNumber: `TRF-${Date.now()}-6`,
        sourceBranchId: warehouseBranchId,
        destinationBranchId: retailBranchId,
        requestedByUserId: userId,
        reviewedByUserId: userId,
        status: StockTransferStatus.REJECTED,
        priority: TransferPriority.NORMAL,
        requestedAt: threeDaysAgo,
        reviewedAt: new Date(threeDaysAgo.getTime() + 14400 * 1000), // 4 hours
        items: {
          create: [
            { productId: productAId, qtyRequested: 5, qtyApproved: null, qtyShipped: 0, qtyReceived: 0 },
          ],
        },
      },
    });
  });

  describe('getOverviewMetrics', () => {
    test('should return correct overview metrics for date range', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const endDate = new Date();

      const metrics = await getOverviewMetrics({
        tenantId,
        startDate,
        endDate,
      });

      expect(metrics.totalTransfers).toBe(6);
      expect(metrics.activeTransfers).toBe(3); // REQUESTED + APPROVED + IN_TRANSIT
      expect(metrics.avgApprovalTime).toBeGreaterThan(0); // Should have avg approval time
      expect(metrics.avgShipTime).toBeGreaterThan(0); // Should have avg ship time
      expect(metrics.avgReceiveTime).toBeGreaterThan(0); // Should have avg receive time (from completed transfers)
    });

    test('should filter by branch when branchId provided', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const metrics = await getOverviewMetrics({
        tenantId,
        startDate,
        endDate,
        branchId: warehouseBranchId,
      });

      // Only transfers involving warehouse (as source or destination)
      expect(metrics.totalTransfers).toBeLessThanOrEqual(6);
      expect(metrics.totalTransfers).toBeGreaterThan(0);
    });

    test('should handle empty result set gracefully', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2020-01-02');

      const metrics = await getOverviewMetrics({
        tenantId,
        startDate,
        endDate,
      });

      expect(metrics.totalTransfers).toBe(0);
      expect(metrics.activeTransfers).toBe(0);
      expect(metrics.avgApprovalTime).toBe(0);
      expect(metrics.avgShipTime).toBe(0);
      expect(metrics.avgReceiveTime).toBe(0);
    });

    test('should calculate average times correctly', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const metrics = await getOverviewMetrics({
        tenantId,
        startDate,
        endDate,
      });

      // All times should be in seconds
      expect(metrics.avgApprovalTime).toBeGreaterThan(900); // > 15 min (fastest)
      expect(metrics.avgApprovalTime).toBeLessThan(14400); // < 4 hours (slowest)
    });

    test('should enforce multi-tenant isolation', async () => {
      const otherTenant = await createTestTenant();

      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const metrics = await getOverviewMetrics({
        tenantId: otherTenant.id,
        startDate,
        endDate,
      });

      expect(metrics.totalTransfers).toBe(0);
      expect(metrics.activeTransfers).toBe(0);
    });
  });

  describe('getVolumeChartData', () => {
    test('should return daily transfer counts', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const data = await getVolumeChartData({
        tenantId,
        startDate,
        endDate,
      });

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Check data structure
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('date');
        expect(data[0]).toHaveProperty('created');
        expect(data[0]).toHaveProperty('approved');
        expect(data[0]).toHaveProperty('shipped');
        expect(data[0]).toHaveProperty('completed');
      }
    });

    test('should group by date correctly', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const data = await getVolumeChartData({
        tenantId,
        startDate,
        endDate,
      });

      // All dates should be unique
      const dates = data.map(d => d.date);
      const uniqueDates = new Set(dates);
      expect(dates.length).toBe(uniqueDates.size);

      // Dates should be in YYYY-MM-DD format
      dates.forEach(date => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    test('should handle date ranges spanning multiple months', async () => {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const endDate = new Date();

      const data = await getVolumeChartData({
        tenantId,
        startDate,
        endDate,
      });

      expect(Array.isArray(data)).toBe(true);
    });

    test('should return empty array for date range with no transfers', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2020-01-02');

      const data = await getVolumeChartData({
        tenantId,
        startDate,
        endDate,
      });

      // Should fill in date range with zero values (for proper chart display)
      expect(data).toEqual([
        { date: '2020-01-01', created: 0, approved: 0, shipped: 0, completed: 0 },
        { date: '2020-01-02', created: 0, approved: 0, shipped: 0, completed: 0 },
      ]);
    });
  });

  describe('getBranchDependencies', () => {
    test('should return transfer counts per route', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const dependencies = await getBranchDependencies({
        tenantId,
        startDate,
        endDate,
      });

      expect(Array.isArray(dependencies)).toBe(true);
      expect(dependencies.length).toBeGreaterThan(0);
    });

    test('should include source and destination branch names', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const dependencies = await getBranchDependencies({
        tenantId,
        startDate,
        endDate,
      });

      dependencies.forEach(dep => {
        expect(dep).toHaveProperty('sourceBranch');
        expect(dep).toHaveProperty('destinationBranch');
        expect(dep).toHaveProperty('transferCount');
        expect(dep).toHaveProperty('totalUnits');
        expect(typeof dep.transferCount).toBe('number');
        expect(typeof dep.totalUnits).toBe('number');
      });
    });

    test('should sort by transfer count descending', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const dependencies = await getBranchDependencies({
        tenantId,
        startDate,
        endDate,
      });

      // Check descending order
      for (let i = 0; i < dependencies.length - 1; i++) {
        expect(dependencies[i]?.transferCount).toBeGreaterThanOrEqual(
          dependencies[i + 1]?.transferCount ?? 0
        );
      }
    });
  });

  describe('getTopRoutes', () => {
    test('should return top N routes', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const routes = await getTopRoutes({
        tenantId,
        startDate,
        endDate,
        limit: 3,
      });

      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeLessThanOrEqual(3);
    });

    test('should calculate average completion time', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const routes = await getTopRoutes({
        tenantId,
        startDate,
        endDate,
      });

      routes.forEach(route => {
        expect(route).toHaveProperty('sourceBranch');
        expect(route).toHaveProperty('destinationBranch');
        expect(route).toHaveProperty('transferCount');
        expect(route).toHaveProperty('totalUnits');
        expect(route).toHaveProperty('avgCompletionTime');

        // avgCompletionTime can be null if no completed transfers
        if (route.avgCompletionTime !== null) {
          expect(typeof route.avgCompletionTime).toBe('number');
          expect(route.avgCompletionTime).toBeGreaterThan(0);
        }
      });
    });

    test('should handle limit parameter', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const routesLimit2 = await getTopRoutes({
        tenantId,
        startDate,
        endDate,
        limit: 2,
      });

      const routesLimit5 = await getTopRoutes({
        tenantId,
        startDate,
        endDate,
        limit: 5,
      });

      expect(routesLimit2.length).toBeLessThanOrEqual(2);
      expect(routesLimit5.length).toBeGreaterThanOrEqual(routesLimit2.length);
    });
  });

  describe('getStatusDistribution', () => {
    test('should return counts for all statuses', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const distribution = await getStatusDistribution({
        tenantId,
        startDate,
        endDate,
      });

      expect(typeof distribution).toBe('object');
      expect(distribution).toHaveProperty('REQUESTED');
      expect(distribution).toHaveProperty('APPROVED');
      expect(distribution).toHaveProperty('IN_TRANSIT');
      expect(distribution).toHaveProperty('COMPLETED');
      expect(distribution).toHaveProperty('REJECTED');

      // Check counts match our test data
      expect(distribution.REQUESTED).toBe(1);
      expect(distribution.APPROVED).toBe(1);
      expect(distribution.IN_TRANSIT).toBe(1);
      expect(distribution.COMPLETED).toBe(2);
      expect(distribution.REJECTED).toBe(1);
    });

    test('should handle missing statuses (return 0)', async () => {
      const otherTenant = await createTestTenant();
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const distribution = await getStatusDistribution({
        tenantId: otherTenant.id,
        startDate,
        endDate,
      });

      // All should be 0 for empty tenant
      expect(distribution.REQUESTED).toBe(0);
      expect(distribution.APPROVED).toBe(0);
      expect(distribution.IN_TRANSIT).toBe(0);
      expect(distribution.COMPLETED).toBe(0);
      expect(distribution.REJECTED).toBe(0);
      expect(distribution.CANCELLED).toBe(0);
    });
  });

  describe('getBottlenecks', () => {
    test('should calculate average time per stage', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const bottlenecks = await getBottlenecks({
        tenantId,
        startDate,
        endDate,
      });

      expect(bottlenecks).toHaveProperty('approvalStage');
      expect(bottlenecks).toHaveProperty('shippingStage');
      expect(bottlenecks).toHaveProperty('receiptStage');

      // All times should be in seconds
      expect(typeof bottlenecks.approvalStage).toBe('number');
      expect(typeof bottlenecks.shippingStage).toBe('number');
      expect(typeof bottlenecks.receiptStage).toBe('number');

      expect(bottlenecks.approvalStage).toBeGreaterThan(0);
      expect(bottlenecks.shippingStage).toBeGreaterThan(0);
      expect(bottlenecks.receiptStage).toBeGreaterThan(0);
    });

    test('should identify slowest stage', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const bottlenecks = await getBottlenecks({
        tenantId,
        startDate,
        endDate,
      });

      // Find the slowest stage
      const stages = [
        { name: 'approval', time: bottlenecks.approvalStage },
        { name: 'shipping', time: bottlenecks.shippingStage },
        { name: 'receipt', time: bottlenecks.receiptStage },
      ];

      const slowest = stages.reduce((prev, current) =>
        current.time > prev.time ? current : prev
      );

      expect(slowest.time).toBeGreaterThan(0);
    });
  });

  describe('getProductFrequency', () => {
    test('should return most transferred products', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const products = await getProductFrequency({
        tenantId,
        startDate,
        endDate,
      });

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(products.length).toBeLessThanOrEqual(2); // We only have 2 products
    });

    test('should calculate total quantity correctly', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const products = await getProductFrequency({
        tenantId,
        startDate,
        endDate,
      });

      products.forEach(product => {
        expect(product).toHaveProperty('productName');
        expect(product).toHaveProperty('transferCount');
        expect(product).toHaveProperty('totalQty');
        expect(product).toHaveProperty('topRoutes');

        expect(typeof product.transferCount).toBe('number');
        expect(typeof product.totalQty).toBe('number');
        expect(Array.isArray(product.topRoutes)).toBe(true);

        expect(product.transferCount).toBeGreaterThan(0);
        expect(product.totalQty).toBeGreaterThan(0);
      });
    });

    test('should list top routes for each product', async () => {
      const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const products = await getProductFrequency({
        tenantId,
        startDate,
        endDate,
      });

      products.forEach(product => {
        expect(product.topRoutes.length).toBeLessThanOrEqual(3); // Top 3 routes
        product.topRoutes.forEach(route => {
          expect(typeof route).toBe('string');
          expect(route).toContain('→'); // Should have arrow separator
        });
      });
    });
  });
});
