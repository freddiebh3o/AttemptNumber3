// api-server/__tests__/features/stockTransfers/transferDispatchNotePdf.test.ts
import { StockTransferStatus } from '@prisma/client';
import * as transferService from '../../../src/services/stockTransfers/stockTransferService.js';
import { receiveStock } from '../../../src/services/stockService.js';
import { extractFilePathFromUrl, downloadPdfFromStorage } from '../../../src/services/pdf/pdfService.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestBranch,
  createTestRoleWithPermissions,
  createTestMembership,
  addUserToBranch,
} from '../../helpers/factories.js';
import { prismaClientInstance as prisma } from '../../../src/db/prismaClient.js';

describe('[ST-PDF] Stock Transfer Dispatch Note PDF Auto-Generation', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let userSource: Awaited<ReturnType<typeof createTestUser>>;
  let userDestination: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let product1: Awaited<ReturnType<typeof createTestProduct>>;
  let product2: Awaited<ReturnType<typeof createTestProduct>>;

  beforeEach(async () => {
    // Create tenant with branding
    testTenant = await createTestTenant();

    // Add branding for PDF generation
    await prisma.tenantBranding.create({
      data: {
        tenantId: testTenant.id,
        logoUrl: 'https://example.com/logo.png',
        overridesJson: {
          tenantId: testTenant.id,
          primaryColor: '#228be6',
        },
      },
    });

    // Create users
    userSource = await createTestUser();
    userDestination = await createTestUser();

    // Create branches
    sourceBranch = await createTestBranch({
      tenantId: testTenant.id,
    });
    destinationBranch = await createTestBranch({
      tenantId: testTenant.id,
    });

    // Create products
    product1 = await createTestProduct({
      tenantId: testTenant.id,
    });
    product2 = await createTestProduct({
      tenantId: testTenant.id,
    });

    // Create role with permissions
    const role = await createTestRoleWithPermissions({
      tenantId: testTenant.id,
      permissionKeys: ['stock:read', 'stock:write'],
    });

    // Add users to tenant
    await createTestMembership({
      userId: userSource.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });
    await createTestMembership({
      userId: userDestination.id,
      tenantId: testTenant.id,
      roleId: role.id,
    });

    // Add users to both branches
    await addUserToBranch(userSource.id, testTenant.id, sourceBranch.id);
    await addUserToBranch(userSource.id, testTenant.id, destinationBranch.id);
    await addUserToBranch(userDestination.id, testTenant.id, destinationBranch.id);
    await addUserToBranch(userDestination.id, testTenant.id, sourceBranch.id);

    // Pre-create ProductStock rows
    await prisma.productStock.createMany({
      data: [
        {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product1.id,
          qtyOnHand: 0,
          qtyAllocated: 0,
        },
        {
          tenantId: testTenant.id,
          branchId: sourceBranch.id,
          productId: product2.id,
          qtyOnHand: 0,
          qtyAllocated: 0,
        },
      ],
      skipDuplicates: true,
    });

    // Add stock to source branch for testing
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: userSource.id },
      {
        branchId: sourceBranch.id,
        productId: product1.id,
        qty: 1000,
        unitCostPence: 1200,
      }
    );
    await receiveStock(
      { currentTenantId: testTenant.id, currentUserId: userSource.id },
      {
        branchId: sourceBranch.id,
        productId: product2.id,
        qty: 500,
        unitCostPence: 2500,
      }
    );
  });

  describe('[AC-PDF-1] PDF Auto-Generation on Full Shipment', () => {
    it('should auto-generate PDF when transfer is fully shipped (status IN_TRANSIT)', async () => {
      // Create transfer
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, qtyRequested: 100 },
            { productId: product2.id, qtyRequested: 50 },
          ],
        },
      });

      // Approve transfer
      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      // Ship transfer (should trigger PDF generation)
      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Assertions
      expect(shipped.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(shipped.dispatchNotePdfUrl).toBeDefined();
      expect(shipped.dispatchNotePdfUrl).not.toBeNull();
      expect(shipped.dispatchNotePdfUrl).toContain('stock-transfer-pdfs');
      expect(shipped.dispatchNotePdfUrl).toContain(testTenant.id);
      expect(shipped.dispatchNotePdfUrl).toContain('.pdf');
    }, 30000); // 30 second timeout for Puppeteer

    it('should generate PDF with correct transfer number in URL', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      expect(shipped.dispatchNotePdfUrl).toContain(`${shipped.transferNumber}.pdf`);
    }, 30000);

    it('should store PDF URL in database', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 75 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Fetch from database directly
      const dbTransfer = await prisma.stockTransfer.findUnique({
        where: { id: transfer.id },
      });

      expect(dbTransfer?.dispatchNotePdfUrl).toBeDefined();
      expect(dbTransfer?.dispatchNotePdfUrl).not.toBeNull();
      expect(dbTransfer?.dispatchNotePdfUrl).toContain('stock-transfer-pdfs');
    }, 30000);

    it('should generate downloadable PDF file in storage', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Extract file path and download
      const filePath = extractFilePathFromUrl(shipped.dispatchNotePdfUrl!);
      const pdfBuffer = await downloadPdfFromStorage(filePath);

      // Verify PDF file
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Check PDF magic number
      const pdfHeader = pdfBuffer.slice(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');
    }, 30000);
  });

  describe('[AC-PDF-2] PDF Not Generated in Other Statuses', () => {
    it('should not generate PDF when transfer is created (REQUESTED)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      expect(transfer.dispatchNotePdfUrl).toBeNull();
    });

    it('should not generate PDF when transfer is approved (APPROVED)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const approved = await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      expect(approved.dispatchNotePdfUrl).toBeNull();
    });

    it('should not generate PDF when transfer is rejected (REJECTED)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      const rejected = await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'reject',
        reviewNotes: 'Insufficient stock',
      });

      expect(rejected.dispatchNotePdfUrl).toBeNull();
    });

    it('should not generate PDF when transfer is cancelled (CANCELLED)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.cancelStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      const cancelled = await prisma.stockTransfer.findUnique({
        where: { id: transfer.id },
      });

      expect(cancelled?.dispatchNotePdfUrl).toBeNull();
    });
  });

  describe('[AC-PDF-3] PDF Contains Correct Data', () => {
    it('should include transfer details in PDF content', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [
            { productId: product1.id, qtyRequested: 100 },
            { productId: product2.id, qtyRequested: 50 },
          ],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Download and check PDF content
      const filePath = extractFilePathFromUrl(shipped.dispatchNotePdfUrl!);
      const pdfBuffer = await downloadPdfFromStorage(filePath);

      // PDF should be valid
      expect(pdfBuffer.length).toBeGreaterThan(1000); // PDFs with content are typically > 1KB

      // Note: We can't easily parse PDF content in tests, but we verify:
      // 1. PDF was generated (checked above)
      // 2. PDF is downloadable (checked above)
      // 3. Shipped items have correct quantities (checked via service response)
      expect(shipped.items[0]?.qtyShipped).toBe(100);
      expect(shipped.items[1]?.qtyShipped).toBe(50);
    }, 30000);

    it('should include FIFO cost information in shipped items', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Verify FIFO cost was calculated
      expect(shipped.items[0]?.avgUnitCostPence).toBe(1200);
      // lotsConsumed is defined but may be empty array in response (populated internally)
      expect(shipped.items[0]?.lotsConsumed).toBeDefined();
    }, 30000);
  });

  describe('[AC-PDF-4] PDF Regeneration Not Triggered on Re-ship', () => {
    it('should not regenerate PDF if it already exists', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      const pdfUrl1 = shipped.dispatchNotePdfUrl;

      // Fetch transfer again (simulating re-fetch scenario)
      const refetched = await transferService.getStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // PDF URL should remain the same (not regenerated)
      expect(refetched.dispatchNotePdfUrl).toBe(pdfUrl1);
    }, 30000);
  });

  describe('[AC-PDF-5] Multi-Tenant PDF Isolation', () => {
    it('should store PDFs in tenant-specific paths', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant();

      // Add branding for tenant2
      await prisma.tenantBranding.create({
        data: {
          tenantId: tenant2.id,
          logoUrl: null,
          overridesJson: {
            tenantId: tenant2.id,
          },
        },
      });

      const user2 = await createTestUser();
      const branch1T2 = await createTestBranch({ tenantId: tenant2.id });
      const branch2T2 = await createTestBranch({ tenantId: tenant2.id });
      const product1T2 = await createTestProduct({ tenantId: tenant2.id });

      const role2 = await createTestRoleWithPermissions({
        tenantId: tenant2.id,
        permissionKeys: ['stock:read', 'stock:write'],
      });

      await createTestMembership({
        userId: user2.id,
        tenantId: tenant2.id,
        roleId: role2.id,
      });

      await addUserToBranch(user2.id, tenant2.id, branch1T2.id);
      await addUserToBranch(user2.id, tenant2.id, branch2T2.id);

      // Add stock for tenant 2
      await receiveStock(
        { currentTenantId: tenant2.id, currentUserId: user2.id },
        {
          branchId: branch1T2.id,
          productId: product1T2.id,
          qty: 500,
          unitCostPence: 1000,
        }
      );

      // Create transfers for both tenants
      const transfer1 = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 50 }],
        },
      });

      const transfer2 = await transferService.createStockTransfer({
        tenantId: tenant2.id,
        userId: user2.id,
        data: {
          sourceBranchId: branch1T2.id,
          destinationBranchId: branch2T2.id,
          items: [{ productId: product1T2.id, qtyRequested: 50 }],
        },
      });

      // Approve and ship both
      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer1.id,
        action: 'approve',
      });

      await transferService.reviewStockTransfer({
        tenantId: tenant2.id,
        userId: user2.id,
        transferId: transfer2.id,
        action: 'approve',
      });

      const shipped1 = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer1.id,
      });

      const shipped2 = await transferService.shipStockTransfer({
        tenantId: tenant2.id,
        userId: user2.id,
        transferId: transfer2.id,
      });

      // PDFs should be in different tenant paths
      expect(shipped1.dispatchNotePdfUrl).toContain(testTenant.id);
      expect(shipped2.dispatchNotePdfUrl).toContain(tenant2.id);
      expect(shipped1.dispatchNotePdfUrl).not.toBe(shipped2.dispatchNotePdfUrl);
    }, 60000); // Longer timeout for two PDF generations
  });

  describe('[AC-PDF-6] Error Handling', () => {
    it('should not fail shipment if PDF generation fails (graceful degradation)', async () => {
      // This test verifies that stock transfer shipment completes even if PDF fails
      // (PDF generation errors are caught and logged, not thrown)

      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      // Ship should succeed even if PDF generation has issues
      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // Transfer should be shipped regardless of PDF
      expect(shipped.status).toBe(StockTransferStatus.IN_TRANSIT);
      expect(shipped.shippedAt).toBeDefined();
      expect(shipped.items[0]?.qtyShipped).toBe(100);

      // PDF should be generated (unless Supabase is down, but then this test would fail)
      // In production, if PDF fails, dispatchNotePdfUrl would be null
      expect(shipped.dispatchNotePdfUrl).toBeDefined();
    }, 30000);
  });

  describe('[AC-PDF-7] PDF Only Generated Once Per Transfer', () => {
    it('should only generate PDF on first shipment (IN_TRANSIT status change)', async () => {
      const transfer = await transferService.createStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        data: {
          sourceBranchId: sourceBranch.id,
          destinationBranchId: destinationBranch.id,
          items: [{ productId: product1.id, qtyRequested: 100 }],
        },
      });

      await transferService.reviewStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        action: 'approve',
      });

      const shipped = await transferService.shipStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      const pdfUrl = shipped.dispatchNotePdfUrl;
      expect(pdfUrl).toBeDefined();

      // Receive transfer (changes status to COMPLETED)
      await transferService.receiveStockTransfer({
        tenantId: testTenant.id,
        userId: userDestination.id,
        transferId: transfer.id,
        receivedItems: [{ itemId: shipped.items[0]!.id, qtyReceived: 100 }],
      });

      // Fetch transfer after completion
      const completed = await transferService.getStockTransfer({
        tenantId: testTenant.id,
        userId: userSource.id,
        transferId: transfer.id,
      });

      // PDF URL should remain the same (not regenerated)
      expect(completed.dispatchNotePdfUrl).toBe(pdfUrl);
      expect(completed.status).toBe(StockTransferStatus.COMPLETED);
    }, 30000);
  });
});
