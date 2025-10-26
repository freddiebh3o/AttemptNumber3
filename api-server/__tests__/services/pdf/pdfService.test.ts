// api-server/__tests__/services/pdf/pdfService.test.ts
import {
  generateDispatchNotePdf,
  downloadPdfFromStorage,
  extractFilePathFromUrl,
} from '../../../src/services/pdf/pdfService.js';
import { createTestTenant, createTestUser, createTestBranch } from '../../helpers/factories.js';

describe('[PDF-SVC] PDF Service', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>>;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let sourceBranch: Awaited<ReturnType<typeof createTestBranch>>;
  let destinationBranch: Awaited<ReturnType<typeof createTestBranch>>;

  beforeEach(async () => {
    testTenant = await createTestTenant();
    testUser = await createTestUser();
    sourceBranch = await createTestBranch({ tenantId: testTenant.id });
    destinationBranch = await createTestBranch({ tenantId: testTenant.id });
  });

  describe('generateDispatchNotePdf - Generate Dispatch Note PDF', () => {
    it('should generate PDF with valid transfer data', async () => {
      const pdfUrl = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0001',
        sourceBranch: {
          name: sourceBranch.branchName,
        },
        destinationBranch: {
          name: destinationBranch.branchName,
        },
        shippedAt: new Date('2025-01-15T14:30:00Z'),
        shippedByUser: {
          fullName: 'John Doe',
        },
        items: [
          {
            productName: 'Test Widget',
            sku: 'WIDGET-001',
            qtyShipped: 10,
            avgUnitCostPence: 1500,
          },
          {
            productName: 'Another Product',
            sku: 'PROD-002',
            qtyShipped: 5,
            avgUnitCostPence: 2000,
          },
        ],
        tenantBranding: {
          logoUrl: null,
          overridesJson: {
            tenantId: testTenant.id,
            primaryColor: '#228be6',
          },
        },
        tenantName: testTenant.tenantName,
      });

      // Assert URL is returned
      expect(pdfUrl).toBeDefined();
      expect(pdfUrl).toContain('stock-transfer-pdfs');
      expect(pdfUrl).toContain('TRF-2025-0001.pdf');
      expect(pdfUrl).toContain(testTenant.id);
    }, 30000); // 30 second timeout for Puppeteer

    it('should generate PDF with tenant logo URL', async () => {
      const logoUrl = 'https://example.com/logo.png';

      const pdfUrl = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0002',
        sourceBranch: {
          name: sourceBranch.branchName,
        },
        destinationBranch: {
          name: destinationBranch.branchName,
        },
        shippedAt: new Date(),
        shippedByUser: {
          fullName: 'Jane Smith',
        },
        items: [
          {
            productName: 'Product A',
            sku: 'A-001',
            qtyShipped: 3,
            avgUnitCostPence: 500,
          },
        ],
        tenantBranding: {
          logoUrl: logoUrl,
          overridesJson: {
            tenantId: testTenant.id,
          },
        },
        tenantName: testTenant.tenantName,
      });

      expect(pdfUrl).toBeDefined();
      expect(pdfUrl).toContain('TRF-2025-0002.pdf');
    }, 30000);

    it('should generate PDF without unit costs (optional field)', async () => {
      const pdfUrl = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0003',
        sourceBranch: {
          name: sourceBranch.branchName,
        },
        destinationBranch: {
          name: destinationBranch.branchName,
        },
        shippedAt: new Date(),
        shippedByUser: {
          fullName: 'Test User',
        },
        items: [
          {
            productName: 'No Cost Product',
            sku: 'NC-001',
            qtyShipped: 7,
            // avgUnitCostPence is optional
          },
        ],
        tenantBranding: {
          logoUrl: null,
          overridesJson: {
            tenantId: testTenant.id,
          },
        },
        tenantName: testTenant.tenantName,
      });

      expect(pdfUrl).toBeDefined();
    }, 30000);

    it('should handle multiple items correctly', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        productName: `Product ${i + 1}`,
        sku: `SKU-${String(i + 1).padStart(3, '0')}`,
        qtyShipped: i + 1,
        avgUnitCostPence: (i + 1) * 100,
      }));

      const pdfUrl = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0004',
        sourceBranch: {
          name: sourceBranch.branchName,
        },
        destinationBranch: {
          name: destinationBranch.branchName,
        },
        shippedAt: new Date(),
        shippedByUser: {
          fullName: 'Bulk Shipper',
        },
        items,
        tenantBranding: {
          logoUrl: null,
          overridesJson: {
            tenantId: testTenant.id,
          },
        },
        tenantName: testTenant.tenantName,
      });

      expect(pdfUrl).toBeDefined();
    }, 30000);

    it('should allow regeneration with upsert', async () => {
      const transferData = {
        transferNumber: 'TRF-2025-0005',
        sourceBranch: {
          name: sourceBranch.branchName,
        },
        destinationBranch: {
          name: destinationBranch.branchName,
        },
        shippedAt: new Date(),
        shippedByUser: {
          fullName: 'Test User',
        },
        items: [
          {
            productName: 'Test',
            sku: 'TEST-001',
            qtyShipped: 1,
            avgUnitCostPence: 100,
          },
        ],
        tenantBranding: {
          logoUrl: null,
          overridesJson: {
            tenantId: testTenant.id,
          },
        },
        tenantName: testTenant.tenantName,
      };

      // First generation
      const pdfUrl1 = await generateDispatchNotePdf(transferData);
      expect(pdfUrl1).toBeDefined();

      // Second generation (regenerate) - should succeed with upsert
      const pdfUrl2 = await generateDispatchNotePdf(transferData);
      expect(pdfUrl2).toBeDefined();
      expect(pdfUrl2).toBe(pdfUrl1); // Same URL (same file path)
    }, 60000); // Longer timeout for two PDF generations
  });

  describe('downloadPdfFromStorage - Download PDF from Supabase', () => {
    it('should download existing PDF', async () => {
      // First generate a PDF
      const pdfUrl = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0010',
        sourceBranch: {
          name: sourceBranch.branchName,
        },
        destinationBranch: {
          name: destinationBranch.branchName,
        },
        shippedAt: new Date(),
        shippedByUser: {
          fullName: 'Downloader',
        },
        items: [
          {
            productName: 'Download Test',
            sku: 'DL-001',
            qtyShipped: 2,
            avgUnitCostPence: 300,
          },
        ],
        tenantBranding: {
          logoUrl: null,
          overridesJson: {
            tenantId: testTenant.id,
          },
        },
        tenantName: testTenant.tenantName,
      });

      // Extract file path from URL
      const filePath = extractFilePathFromUrl(pdfUrl);

      // Download the PDF
      const pdfBuffer = await downloadPdfFromStorage(filePath);

      // Assert buffer is valid
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Check PDF magic number (PDF starts with %PDF)
      const pdfHeader = pdfBuffer.slice(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');
    }, 30000);

    it('should throw error for non-existent PDF', async () => {
      await expect(downloadPdfFromStorage('non-existent-tenant/non-existent.pdf')).rejects.toThrow(
        'PDF not found'
      );
    });
  });

  describe('extractFilePathFromUrl - Extract File Path from URL', () => {
    it('should extract file path from valid Supabase URL', () => {
      const url =
        'https://vbhobqlqgovkowyaxyxx.supabase.co/storage/v1/object/public/stock-transfer-pdfs/tenant_123/TRF-2025-0001.pdf';

      const filePath = extractFilePathFromUrl(url);

      expect(filePath).toBe('tenant_123/TRF-2025-0001.pdf');
    });

    it('should throw error for invalid URL format', () => {
      const invalidUrl = 'https://example.com/some/path.pdf';

      expect(() => extractFilePathFromUrl(invalidUrl)).toThrow('Invalid PDF URL format');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should store PDFs in tenant-specific paths', async () => {
      const tenant1 = await createTestTenant();
      const tenant2 = await createTestTenant();

      const branch1 = await createTestBranch({ tenantId: tenant1.id });
      const branch2 = await createTestBranch({ tenantId: tenant2.id });

      // Generate PDF for tenant 1
      const pdf1Url = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0001',
        sourceBranch: { name: branch1.branchName },
        destinationBranch: { name: branch2.branchName },
        shippedAt: new Date(),
        shippedByUser: { fullName: 'User 1' },
        items: [{ productName: 'Test', sku: 'T1', qtyShipped: 1 }],
        tenantBranding: {
          logoUrl: null,
          overridesJson: { tenantId: tenant1.id },
        },
        tenantName: tenant1.tenantName,
      });

      // Generate PDF for tenant 2
      const pdf2Url = await generateDispatchNotePdf({
        transferNumber: 'TRF-2025-0001', // Same transfer number but different tenant
        sourceBranch: { name: branch1.branchName },
        destinationBranch: { name: branch2.branchName },
        shippedAt: new Date(),
        shippedByUser: { fullName: 'User 2' },
        items: [{ productName: 'Test', sku: 'T2', qtyShipped: 1 }],
        tenantBranding: {
          logoUrl: null,
          overridesJson: { tenantId: tenant2.id },
        },
        tenantName: tenant2.tenantName,
      });

      // URLs should be different (different tenant IDs in path)
      expect(pdf1Url).toContain(tenant1.id);
      expect(pdf2Url).toContain(tenant2.id);
      expect(pdf1Url).not.toBe(pdf2Url);
    }, 60000);
  });

  // Note: Error handling tests for Supabase upload failures would require
  // mocking, which is complex with ES modules. Manual testing or integration
  // tests are recommended for upload error scenarios.
});
