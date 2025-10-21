// api-server/__tests__/features/auditLogs/auditLogService.test.ts
import { writeAuditEvent } from '../../../src/services/auditLoggerService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestAuditEvent,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';
import type { AuditEvent, AuditEntityType, AuditAction } from '@prisma/client';

describe('Audit Log Service', () => {
  let testTenant1: Awaited<ReturnType<typeof createTestTenant>>;
  let testTenant2: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser1: Awaited<ReturnType<typeof createTestUser>>;
  let testUser2: Awaited<ReturnType<typeof createTestUser>>;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    testTenant1 = await createTestTenant();
    testTenant2 = await createTestTenant();
    testUser1 = await createTestUser();
    testUser2 = await createTestUser();
    testProduct = await createTestProduct({ tenantId: testTenant1.id });
  });

  describe('writeAuditEvent - Create audit log entries', () => {
    it('should create audit event with all fields', async () => {
      const beforeState = { productName: 'Old Name', productPricePence: 1000 };
      const afterState = { productName: 'New Name', productPricePence: 1500 };

      await writeAuditEvent(prisma, {
        tenantId: testTenant1.id,
        actorUserId: testUser1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
        entityName: 'Test Product',
        before: beforeState,
        after: afterState,
        correlationId: 'test-correlation-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          entityId: testProduct.id,
          action: 'UPDATE',
        },
      });

      expect(auditEvent).toBeDefined();
      expect(auditEvent?.tenantId).toBe(testTenant1.id);
      expect(auditEvent?.actorUserId).toBe(testUser1.id);
      expect(auditEvent?.entityType).toBe('PRODUCT');
      expect(auditEvent?.entityName).toBe('Test Product');
      expect(auditEvent?.correlationId).toBe('test-correlation-123');
      expect(auditEvent?.ip).toBe('192.168.1.1');
      expect(auditEvent?.userAgent).toBe('Mozilla/5.0');
    });

    it('should create audit event without actor (system action)', async () => {
      await writeAuditEvent(prisma, {
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        entityName: 'System Product',
      });

      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          entityId: testProduct.id,
          action: 'CREATE',
        },
      });

      expect(auditEvent).toBeDefined();
      expect(auditEvent?.actorUserId).toBeNull();
      expect(auditEvent?.entityName).toBe('System Product');
    });

    it('should redact sensitive fields in snapshots', async () => {
      // Use an entity type that allows custom fields to test redaction
      // The default switch case in whitelistSnapshot will redact sensitive fields
      const sensitiveData = {
        email: 'user@example.com',
        password: 'secret123',
        apiKey: 'key-12345',
        token: 'token-abcde',
        normalField: 'normal-value',
      };

      await writeAuditEvent(prisma, {
        tenantId: testTenant1.id,
        entityType: 'TENANT_BRANDING' as any, // Use a type not in whitelist to hit default case
        entityId: testUser1.id,
        action: 'CREATE',
        after: sensitiveData,
      });

      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          entityId: testUser1.id,
          entityType: 'TENANT_BRANDING',
        },
      });

      expect(auditEvent).toBeDefined();
      const afterJson = auditEvent?.afterJson as any;
      // These fields should be redacted by the redact() function
      expect(afterJson.password).toBe('[REDACTED]');
      expect(afterJson.apiKey).toBe('[REDACTED]');
      expect(afterJson.token).toBe('[REDACTED]');
      // Email and normalField should NOT be redacted
      expect(afterJson.email).toBe('user@example.com');
      expect(afterJson.normalField).toBe('normal-value');
    });

    it('should create diff when before and after snapshots provided', async () => {
      const before = { productName: 'Old Name', productPricePence: 1000 };
      const after = { productName: 'New Name', productPricePence: 1000 };

      await writeAuditEvent(prisma, {
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
        before,
        after,
      });

      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          entityId: testProduct.id,
        },
      });

      expect(auditEvent).toBeDefined();
      const diffJson = auditEvent?.diffJson as any;
      expect(diffJson).toBeDefined();
      expect(diffJson.productName).toEqual({ from: 'Old Name', to: 'New Name' });
      expect(diffJson.productPricePence).toBeUndefined(); // No change
    });
  });

  describe('Query audit logs - Multi-tenant isolation', () => {
    beforeEach(async () => {
      // Create audit events for tenant 1
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser1.id,
      });

      // Create audit events for tenant 2
      const tenant2Product = await createTestProduct({ tenantId: testTenant2.id });
      await createTestAuditEvent({
        tenantId: testTenant2.id,
        entityType: 'PRODUCT',
        entityId: tenant2Product.id,
        action: 'CREATE',
        actorUserId: testUser2.id,
      });
    });

    it('should only return audit logs for current tenant', async () => {
      const tenant1Logs = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant1.id },
      });

      const tenant2Logs = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant2.id },
      });

      expect(tenant1Logs.length).toBeGreaterThan(0);
      expect(tenant2Logs.length).toBeGreaterThan(0);

      // Verify tenant isolation
      tenant1Logs.forEach((log) => {
        expect(log.tenantId).toBe(testTenant1.id);
      });

      tenant2Logs.forEach((log) => {
        expect(log.tenantId).toBe(testTenant2.id);
      });
    });

    it('should not allow cross-tenant audit log access', async () => {
      const tenant1Logs = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant1.id },
      });

      // Try to find tenant2 logs with tenant1 filter
      const crossTenantAttempt = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          actorUserId: testUser2.id, // User from tenant 2
        },
      });

      expect(tenant1Logs.length).toBeGreaterThan(0);
      expect(crossTenantAttempt.length).toBe(0); // Should not find any
    });
  });

  describe('Filter audit logs - By entity type', () => {
    beforeEach(async () => {
      const branch = await createTestBranch({ tenantId: testTenant1.id });

      // Create different entity types
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'BRANCH',
        entityId: branch.id,
        action: 'CREATE',
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'USER',
        entityId: testUser1.id,
        action: 'UPDATE',
      });
    });

    it('should filter by PRODUCT entity type', async () => {
      const productLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          entityType: 'PRODUCT',
        },
      });

      expect(productLogs.length).toBeGreaterThan(0);
      productLogs.forEach((log) => {
        expect(log.entityType).toBe('PRODUCT');
      });
    });

    it('should filter by BRANCH entity type', async () => {
      const branchLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          entityType: 'BRANCH',
        },
      });

      expect(branchLogs.length).toBeGreaterThan(0);
      branchLogs.forEach((log) => {
        expect(log.entityType).toBe('BRANCH');
      });
    });

    it('should filter by USER entity type', async () => {
      const userLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          entityType: 'USER',
        },
      });

      expect(userLogs.length).toBeGreaterThan(0);
      userLogs.forEach((log) => {
        expect(log.entityType).toBe('USER');
      });
    });
  });

  describe('Filter audit logs - By action', () => {
    beforeEach(async () => {
      // Create different action types
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'DELETE',
      });
    });

    it('should filter by CREATE action', async () => {
      const createLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          action: 'CREATE',
        },
      });

      expect(createLogs.length).toBeGreaterThan(0);
      createLogs.forEach((log) => {
        expect(log.action).toBe('CREATE');
      });
    });

    it('should filter by UPDATE action', async () => {
      const updateLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          action: 'UPDATE',
        },
      });

      expect(updateLogs.length).toBeGreaterThan(0);
      updateLogs.forEach((log) => {
        expect(log.action).toBe('UPDATE');
      });
    });

    it('should filter by DELETE action', async () => {
      const deleteLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          action: 'DELETE',
        },
      });

      expect(deleteLogs.length).toBeGreaterThan(0);
      deleteLogs.forEach((log) => {
        expect(log.action).toBe('DELETE');
      });
    });
  });

  describe('Filter audit logs - By actor user', () => {
    beforeEach(async () => {
      // Create events by different users
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser1.id,
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
        actorUserId: testUser2.id,
      });

      // System action (no actor)
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'DELETE',
      });
    });

    it('should filter by specific actor user', async () => {
      const user1Logs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          actorUserId: testUser1.id,
        },
      });

      expect(user1Logs.length).toBeGreaterThan(0);
      user1Logs.forEach((log) => {
        expect(log.actorUserId).toBe(testUser1.id);
      });
    });

    it('should filter system actions (no actor)', async () => {
      const systemLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          actorUserId: null,
        },
      });

      expect(systemLogs.length).toBeGreaterThan(0);
      systemLogs.forEach((log) => {
        expect(log.actorUserId).toBeNull();
      });
    });
  });

  describe('Filter audit logs - By date range', () => {
    beforeEach(async () => {
      // Create events at different times (Note: We can't easily control createdAt in tests,
      // so we'll create them sequentially and rely on timing)
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'DELETE',
      });
    });

    it('should filter by date range (recent events)', async () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const recentLogs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          createdAt: {
            gte: tenMinutesAgo,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(recentLogs.length).toBeGreaterThan(0);
      recentLogs.forEach((log) => {
        expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(tenMinutesAgo.getTime());
      });
    });

    it('should filter by date range (specific window)', async () => {
      // Get all logs to find the time range
      const allLogs = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant1.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(allLogs.length).toBeGreaterThan(0);

      const firstLog = allLogs[0];
      const lastLog = allLogs[allLogs.length - 1];

      // Query with exact range
      const logsInRange = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          createdAt: {
            gte: firstLog?.createdAt ?? new Date(),
            lte: lastLog?.createdAt ?? new Date(),
          },
        },
      });

      expect(logsInRange.length).toBe(allLogs.length);
    });
  });

  describe('Pagination support', () => {
    beforeEach(async () => {
      // Create multiple audit events for pagination testing
      for (let i = 0; i < 15; i++) {
        await createTestAuditEvent({
          tenantId: testTenant1.id,
          entityType: 'PRODUCT',
          entityId: testProduct.id,
          action: 'UPDATE',
          actorUserId: testUser1.id,
        });
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    });

    it('should support cursor-based pagination', async () => {
      // First page
      const firstPage = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant1.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      });

      expect(firstPage.length).toBe(5);

      // Second page using cursor
      const secondPage = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant1.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        cursor: { id: firstPage[firstPage.length - 1]?.id ?? '' },
        skip: 1, // Skip the cursor itself
      });

      expect(secondPage.length).toBe(5);
      expect(secondPage[0]?.id).not.toBe(firstPage[firstPage.length - 1]?.id ?? '');
    });

    it('should support limit-based pagination', async () => {
      const limit = 10;
      const logs = await prisma.auditEvent.findMany({
        where: { tenantId: testTenant1.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });

      expect(logs.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('Get audit log by ID', () => {
    let auditEvent: AuditEvent;

    beforeEach(async () => {
      auditEvent = await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser1.id,
      });
    });

    it('should retrieve audit log by ID within tenant', async () => {
      const log = await prisma.auditEvent.findFirst({
        where: {
          id: auditEvent.id,
          tenantId: testTenant1.id,
        },
      });

      expect(log).toBeDefined();
      expect(log?.id).toBe(auditEvent.id);
      expect(log?.tenantId).toBe(testTenant1.id);
    });

    it('should not retrieve audit log from different tenant', async () => {
      const log = await prisma.auditEvent.findFirst({
        where: {
          id: auditEvent.id,
          tenantId: testTenant2.id, // Different tenant
        },
      });

      expect(log).toBeNull();
    });
  });

  describe('Audit log immutability', () => {
    let auditEvent: AuditEvent;

    beforeEach(async () => {
      auditEvent = await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser1.id,
        entityName: 'Original Name',
      });
    });

    it('should maintain audit log data integrity', async () => {
      // Verify audit log can be read and data is intact
      const log = await prisma.auditEvent.findUnique({
        where: { id: auditEvent.id },
      });

      expect(log).toBeDefined();
      expect(log?.entityName).toBe('Original Name');
      expect(log?.action).toBe('CREATE');
      expect(log?.entityId).toBe(testProduct.id);
      expect(log?.tenantId).toBe(testTenant1.id);
    });

    it('should preserve createdAt timestamp', async () => {
      // Audit logs should have immutable timestamps
      const log = await prisma.auditEvent.findUnique({
        where: { id: auditEvent.id },
      });

      expect(log?.createdAt).toBeDefined();
      expect(log?.createdAt).toBeInstanceOf(Date);

      // Verify timestamp matches the one from creation
      expect(log?.createdAt.getTime()).toBe(auditEvent.createdAt.getTime());
    });

    it('should verify audit log remains unchanged', async () => {
      // Retrieve the audit log
      const log = await prisma.auditEvent.findUnique({
        where: { id: auditEvent.id },
      });

      expect(log).toBeDefined();
      expect(log?.entityName).toBe('Original Name');
      expect(log?.action).toBe('CREATE');
    });
  });

  describe('Complex filtering scenarios', () => {
    beforeEach(async () => {
      const branch = await createTestBranch({ tenantId: testTenant1.id });

      // Create a variety of audit events
      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'CREATE',
        actorUserId: testUser1.id,
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'PRODUCT',
        entityId: testProduct.id,
        action: 'UPDATE',
        actorUserId: testUser1.id,
      });

      await createTestAuditEvent({
        tenantId: testTenant1.id,
        entityType: 'BRANCH',
        entityId: branch.id,
        action: 'CREATE',
        actorUserId: testUser2.id,
      });
    });

    it('should filter by entity type AND action', async () => {
      const logs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          entityType: 'PRODUCT',
          action: 'UPDATE',
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.entityType).toBe('PRODUCT');
        expect(log.action).toBe('UPDATE');
      });
    });

    it('should filter by entity type AND actor user', async () => {
      const logs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          entityType: 'PRODUCT',
          actorUserId: testUser1.id,
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.entityType).toBe('PRODUCT');
        expect(log.actorUserId).toBe(testUser1.id);
      });
    });

    it('should filter by specific entity ID', async () => {
      const logs = await prisma.auditEvent.findMany({
        where: {
          tenantId: testTenant1.id,
          entityId: testProduct.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.entityId).toBe(testProduct.id);
      });
    });
  });
});
