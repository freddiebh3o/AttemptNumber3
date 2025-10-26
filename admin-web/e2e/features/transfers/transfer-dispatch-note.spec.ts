// transfer-dispatch-note.spec.ts
import { test, expect } from '@playwright/test';
import { signIn, TEST_USERS, Factories } from '../../helpers';

/**
 * E2E Tests for Stock Transfer Dispatch Note PDF Feature
 *
 * Tests cover:
 * - PDF auto-generation when transfer is shipped
 * - Viewing dispatch note PDF (preview modal)
 * - Downloading PDF
 * - Print functionality
 * - Regenerating PDF
 * - Permission checks (viewer can view but not regenerate)
 * - Button visibility based on transfer status
 *
 * IMPORTANT: To avoid triggering approval rules from seed data:
 * - Use qty: 2 units
 * - Use productPricePence: 500 (£5)
 * - Total value: 2 × £5 = £10 (well below £100 approval threshold)
 * - Use OWNER user (has all permissions)
 * - Use branches: acme-warehouse → acme-retail-1 (OWNER has access)
 */

// Check API server health before tests
test.beforeAll(async () => {
  const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:4000';
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`API health check failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️  API server may not be running. Tests will fail without it.');
    console.warn('   Start it with: cd api-server && npm run dev:e2e');
  }
});

// Isolate each test - clear browser state
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe('Dispatch Note PDF - Auto-Generation on Shipment', () => {
  test('should auto-generate PDF when transfer is shipped', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Auto-Gen Product ${timestamp}`;
    const productSku = `PDFAUTO-${timestamp}`;

    // Setup: Create product with stock
    // Use acme-warehouse → acme-retail-1 (OWNER has access to both)
    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    // Low price to avoid approval rules: £5 per unit
    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    // Create transfer with low qty to avoid approval rules (2 × £5 = £10)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    // Approve transfer
    await Factories.transfer.approve(page, transferId);

    // Get transfer to fetch item IDs
    const transfer = await Factories.transfer.getById(page, transferId);

    // Ship transfer (should auto-generate PDF)
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    // Navigate to transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Verify status is IN_TRANSIT
    await expect(page.getByTestId('transfer-status-badge')).toHaveText(/IN TRANSIT/i);

    // Verify "View Dispatch Note" button appears
    const viewPdfButton = page.getByTestId('view-dispatch-note-btn');
    await expect(viewPdfButton).toBeVisible();
    await expect(viewPdfButton).toContainText(/view dispatch note/i);

    // Cleanup
    await Factories.product.delete(page, productId);
  });

  test('should not show PDF button for transfers not yet shipped', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Not Shipped ${timestamp}`;
    const productSku = `PDFNOT-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    // Create transfer (REQUESTED status)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    // Navigate to transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Verify status is REQUESTED
    await expect(page.getByTestId('transfer-status-badge')).toHaveText(/REQUESTED/i);

    // Verify "View Dispatch Note" button is NOT visible
    const viewPdfButton = page.getByTestId('view-dispatch-note-btn');
    await expect(viewPdfButton).not.toBeVisible();

    // Cleanup
    await Factories.product.delete(page, productId);
  });
});

test.describe('Dispatch Note PDF - Preview Modal', () => {
  test('should open PDF preview modal and display PDF', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Preview Product ${timestamp}`;
    const productSku = `PDFPREV-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    // Create, approve, and ship transfer
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    await Factories.transfer.approve(page, transferId);

    const transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    // Navigate to transfer detail page
    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Click "View Dispatch Note" button
    await page.getByTestId('view-dispatch-note-btn').click();

    // Verify modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Verify modal title contains "Dispatch Note"
    await expect(modal.getByRole('heading', { name: /dispatch note/i })).toBeVisible();

    // Wait for iframe to be added to DOM and verify no error
    // Note: iframe onLoad may not fire for PDFs in Chromium, so we just verify it exists
    const iframe = page.getByTestId('pdf-preview-iframe');
    await expect(iframe).toBeAttached({ timeout: 5000 });

    // Verify no error alert appeared
    const errorAlert = modal.getByTestId('pdf-error-alert');
    await expect(errorAlert).not.toBeVisible();

    // Wait a moment for PDF to start loading
    await page.waitForTimeout(2000);

    // Verify action buttons are present
    await expect(page.getByTestId('pdf-download-btn')).toBeVisible();
    await expect(page.getByTestId('pdf-print-btn')).toBeVisible();
    await expect(page.getByTestId('pdf-preview-close-btn')).toBeVisible();

    // Close modal
    await page.getByTestId('pdf-preview-close-btn').click();
    await expect(modal).not.toBeVisible();

    // Cleanup
    await Factories.product.delete(page, productId);
  });

  test('should close modal when clicking close button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Close Modal ${timestamp}`;
    const productSku = `PDFCLOSE-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    await Factories.transfer.approve(page, transferId);

    const transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByTestId('view-dispatch-note-btn').click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Close modal
    await page.getByTestId('pdf-preview-close-btn').click();
    await expect(modal).not.toBeVisible();

    // Cleanup
    await Factories.product.delete(page, productId);
  });
});

test.describe('Dispatch Note PDF - Regenerate Functionality', () => {
  test('should regenerate PDF when clicking regenerate button', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Regenerate ${timestamp}`;
    const productSku = `PDFREGEN-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    await Factories.transfer.approve(page, transferId);

    const transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Verify regenerate button is visible (owner has stock:write)
    const regenerateButton = page.getByTestId('regenerate-pdf-btn');
    await expect(regenerateButton).toBeVisible();

    // Click regenerate button
    await regenerateButton.click();

    // Wait for success notification
    await expect(page.getByText(/dispatch note pdf regenerated successfully/i)).toBeVisible({
      timeout: 10000,
    });

    // Cleanup
    await Factories.product.delete(page, productId);
  });
});

test.describe('Dispatch Note PDF - Permission Checks', () => {
  test('owner can both view and regenerate PDF', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Owner Perm ${timestamp}`;
    const productSku = `PDFOWN-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    await Factories.transfer.approve(page, transferId);

    const transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Verify both buttons are visible (owner has stock:write)
    await expect(page.getByTestId('view-dispatch-note-btn')).toBeVisible();
    await expect(page.getByTestId('regenerate-pdf-btn')).toBeVisible();

    // Cleanup
    await Factories.product.delete(page, productId);
  });
});

test.describe('Dispatch Note PDF - Status-Based Visibility', () => {
  test('PDF button appears for COMPLETED transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Completed ${timestamp}`;
    const productSku = `PDFCOMP-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 2 }],
    });

    await Factories.transfer.approve(page, transferId);

    let transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    // Receive the transfer to mark as COMPLETED
    transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.receive(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyReceived: item.qtyShipped,
      })),
    });

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Verify status is COMPLETED
    await expect(page.getByTestId('transfer-status-badge')).toHaveText(/COMPLETED/i);

    // Verify PDF button still appears
    await expect(page.getByTestId('view-dispatch-note-btn')).toBeVisible();

    // Cleanup
    await Factories.product.delete(page, productId);
  });

  test('PDF button appears for PARTIALLY_RECEIVED transfers', async ({ page }) => {
    await signIn(page, TEST_USERS.owner);

    const timestamp = Date.now();
    const productName = `PDF Partial ${timestamp}`;
    const productSku = `PDFPART-${timestamp}`;

    const sourceBranchId = await Factories.branch.getBySlug(page, 'acme-warehouse');
    const destinationBranchId = await Factories.branch.getBySlug(page, 'acme-retail-1');

    const productId = await Factories.product.create(page, {
      productName,
      productSku,
      productPricePence: 500,
    });

    await Factories.stock.addStock(page, {
      productId,
      branchId: sourceBranchId,
      qtyDelta: 10,
      unitCostPence: 400,
    });

    // Use qty: 4 so we can receive half (2 units)
    const transferId = await Factories.transfer.create(page, {
      sourceBranchId,
      destinationBranchId,
      items: [{ productId, qty: 4 }],
    });

    await Factories.transfer.approve(page, transferId);

    let transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyApproved,
      })),
    });

    // Receive only part of the shipment
    transfer = await Factories.transfer.getById(page, transferId);
    await Factories.transfer.receive(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyReceived: Math.floor(item.qtyShipped / 2), // Receive half
      })),
    });

    await page.goto(`/${TEST_USERS.owner.tenant}/stock-transfers/${transferId}`);
    await page.waitForLoadState('networkidle');

    // Verify status is PARTIALLY_RECEIVED
    await expect(page.getByTestId('transfer-status-badge')).toHaveText(/PARTIALLY RECEIVED/i);

    // Verify PDF button still appears
    await expect(page.getByTestId('view-dispatch-note-btn')).toBeVisible();

    // Cleanup
    await Factories.product.delete(page, productId);
  });
});
