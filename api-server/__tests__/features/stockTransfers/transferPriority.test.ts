/**
 * Transfer Priority Tests
 * Tests for priority assignment and updates
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { PrismaClient, StockTransferStatus, TransferPriority, AuditAction } from '@prisma/client';
import { createStockTransfer, updateTransferPriority, listStockTransfers } from '../../../src/services/stockTransfers/stockTransferService.js';
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

describe('Transfer Priority', () => {
  let tenantId: string;
  let ownerUserId: string;
  let editorUserId: string;
  let sourceBranchId: string;
  let destBranchId: string;
  let productId: string;

  beforeAll(async () => {
    // Create test tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Create owner user
    const ownerUser = await createTestUser({ email: `owner-${Date.now()}@test.com` });
    ownerUserId = ownerUser.id;

    const ownerRole = await createTestRoleWithPermissions({
      tenantId,
      permissionKeys: ROLE_DEFS.OWNER,
    });
    await addUserToTenant(ownerUserId, tenantId, ownerRole.id);

    // Create editor user
    const editorUser = await createTestUser({ email: `editor-${Date.now()}@test.com` });
    editorUserId = editorUser.id;

    const editorRole = await createTestRoleWithPermissions({
      tenantId,
      permissionKeys: ROLE_DEFS.EDITOR,
    });
    await addUserToTenant(editorUserId, tenantId, editorRole.id);

    // Create branches
    const sourceBranch = await createTestBranch({ tenantId, name: 'Source Branch' });
    sourceBranchId = sourceBranch.id;
    await addUserToBranch(ownerUserId, tenantId, sourceBranchId);
    await addUserToBranch(editorUserId, tenantId, sourceBranchId);

    const destBranch = await createTestBranch({ tenantId, name: 'Dest Branch' });
    destBranchId = destBranch.id;
    await addUserToBranch(ownerUserId, tenantId, destBranchId);

    // Create product
    const product = await createTestProduct({ tenantId, pricePence: 500 });
    productId = product.id;
  });

  describe('createStockTransfer with priority', () => {
    test('should create transfer with NORMAL priority by default', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      expect(transfer.priority).toBe(TransferPriority.NORMAL);
    });

    test('should create transfer with specified URGENT priority', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.URGENT,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      expect(transfer.priority).toBe(TransferPriority.URGENT);
    });

    test('should create transfer with HIGH priority', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.HIGH,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      expect(transfer.priority).toBe(TransferPriority.HIGH);
    });

    test('should create transfer with LOW priority', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.LOW,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      expect(transfer.priority).toBe(TransferPriority.LOW);
    });
  });

  describe('updateTransferPriority', () => {
    test('should update priority for REQUESTED transfer', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      expect(transfer.status).toBe(StockTransferStatus.REQUESTED);

      const updated = await updateTransferPriority({
        tenantId,
        userId: ownerUserId,
        transferId: transfer.id,
        priority: TransferPriority.URGENT,
      });

      expect(updated.priority).toBe(TransferPriority.URGENT);
    });

    test('should update priority for APPROVED transfer', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      // Manually set to APPROVED
      await prisma.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: StockTransferStatus.APPROVED },
      });

      const updated = await updateTransferPriority({
        tenantId,
        userId: ownerUserId,
        transferId: transfer.id,
        priority: TransferPriority.HIGH,
      });

      expect(updated.priority).toBe(TransferPriority.HIGH);
    });

    test('should reject priority update for IN_TRANSIT transfer', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      // Manually set to IN_TRANSIT
      await prisma.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: StockTransferStatus.IN_TRANSIT },
      });

      await expect(
        updateTransferPriority({
          tenantId,
          userId: ownerUserId,
          transferId: transfer.id,
          priority: TransferPriority.HIGH,
        })
      ).rejects.toThrow();
    });

    test('should reject priority update for COMPLETED transfer', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      // Manually set to COMPLETED
      await prisma.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: StockTransferStatus.COMPLETED },
      });

      await expect(
        updateTransferPriority({
          tenantId,
          userId: ownerUserId,
          transferId: transfer.id,
          priority: TransferPriority.HIGH,
        })
      ).rejects.toThrow();
    });

    test('should create audit event for priority change', async () => {
      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      await updateTransferPriority({
        tenantId,
        userId: ownerUserId,
        transferId: transfer.id,
        priority: TransferPriority.URGENT,
      });

      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          entityId: transfer.id,
          action: AuditAction.TRANSFER_PRIORITY_CHANGE,
        },
      });

      expect(auditEvents.length).toBeGreaterThan(0);
      const latestEvent = auditEvents[auditEvents.length - 1];
      expect(latestEvent?.action).toBe(AuditAction.TRANSFER_PRIORITY_CHANGE);
    });

    test('should require user to be in source or destination branch', async () => {
      // Create two new branches not associated with editorUser
      const branch1 = await createTestBranch({ tenantId, name: 'Branch 1' });
      const branch2 = await createTestBranch({ tenantId, name: 'Branch 2' });
      // Add ownerUser to both branches so they can create the transfer
      await addUserToBranch(ownerUserId, tenantId, branch1.id);
      await addUserToBranch(ownerUserId, tenantId, branch2.id);

      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId: branch1.id, // editorUser is NOT in branch1
          destinationBranchId: branch2.id, // editorUser is NOT in branch2
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      // editorUser should not be able to update priority (not in EITHER branch)
      await expect(
        updateTransferPriority({
          tenantId,
          userId: editorUserId,
          transferId: transfer.id,
          priority: TransferPriority.HIGH,
        })
      ).rejects.toThrow();
    });

    test('should enforce multi-tenant isolation', async () => {
      const otherTenant = await createTestTenant();

      const transfer = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 10 }],
        },
      });

      // Attempting to update with wrong tenantId should fail
      await expect(
        updateTransferPriority({
          tenantId: otherTenant.id,
          userId: ownerUserId,
          transferId: transfer.id,
          priority: TransferPriority.HIGH,
        })
      ).rejects.toThrow();
    });
  });

  describe('listStockTransfers with priority sorting', () => {
    beforeAll(async () => {
      // Create transfers with different priorities
      await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.LOW,
          items: [{ productId, qtyRequested: 5 }],
        },
      });

      await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.URGENT,
          items: [{ productId, qtyRequested: 5 }],
        },
      });

      await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.HIGH,
          items: [{ productId, qtyRequested: 5 }],
        },
      });

      await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 5 }],
        },
      });
    });

    test('should sort by priority first (URGENT→HIGH→NORMAL→LOW)', async () => {
      const { items } = await listStockTransfers({
        tenantId,
        userId: ownerUserId,
        filters: {},
      });

      // Find all unique priorities
      const priorities = items.map((t) => t.priority);

      // Verify URGENT comes before HIGH, which comes before NORMAL, which comes before LOW
      const urgentIndex = priorities.indexOf(TransferPriority.URGENT);
      const highIndex = priorities.indexOf(TransferPriority.HIGH);
      const normalIndex = priorities.indexOf(TransferPriority.NORMAL);
      const lowIndex = priorities.indexOf(TransferPriority.LOW);

      if (urgentIndex !== -1 && highIndex !== -1) {
        expect(urgentIndex).toBeLessThan(highIndex);
      }
      if (highIndex !== -1 && normalIndex !== -1) {
        expect(highIndex).toBeLessThan(normalIndex);
      }
      if (normalIndex !== -1 && lowIndex !== -1) {
        expect(normalIndex).toBeLessThan(lowIndex);
      }
    });

    test('should sort by date within same priority', async () => {
      // Create multiple transfers with same priority
      const transfer1 = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 5 }],
        },
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const transfer2 = await createStockTransfer({
        tenantId,
        userId: ownerUserId,
        data: {
          sourceBranchId,
          destinationBranchId: destBranchId,
          priority: TransferPriority.NORMAL,
          items: [{ productId, qtyRequested: 5 }],
        },
      });

      const { items } = await listStockTransfers({
        tenantId,
        userId: ownerUserId,
        filters: {},
      });

      const transfer1Index = items.findIndex((t) => t.id === transfer1.id);
      const transfer2Index = items.findIndex((t) => t.id === transfer2.id);

      // Newer transfer (transfer2) should come before older (transfer1) if sorted descending
      if (transfer1Index !== -1 && transfer2Index !== -1) {
        expect(transfer2Index).toBeLessThan(transfer1Index);
      }
    });

    test('should handle mixed priorities correctly', async () => {
      const { items } = await listStockTransfers({
        tenantId,
        userId: ownerUserId,
        filters: {},
      });

      // Verify we have transfers with different priorities
      const uniquePriorities = new Set(items.map((t) => t.priority));
      expect(uniquePriorities.size).toBeGreaterThan(1);
    });
  });
});
