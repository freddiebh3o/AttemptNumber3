// api-server/src/services/pdf/pdfService.ts
import puppeteer from 'puppeteer';
import { supabaseAdmin } from '../../integrations/supabaseClient.js';
import { Errors } from '../../utils/httpErrors.js';
import { generateDispatchNoteHtml, type DispatchNoteData } from './dispatchNoteTemplate.js';

const SUPABASE_PDF_BUCKET = 'stock-transfer-pdfs';

/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePdfFromHtml(html: string): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Puppeteer error';
    throw Errors.internal(`Failed to generate PDF: ${errorMessage}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Upload PDF buffer to Supabase Storage
 * @returns Public URL of uploaded PDF
 */
async function uploadPdfToStorage(params: {
  tenantId: string;
  transferNumber: string;
  pdfBuffer: Buffer;
}): Promise<string> {
  const { tenantId, transferNumber, pdfBuffer } = params;

  // File path: {tenantId}/TRF-YYYY-NNNN.pdf
  const filePath = `${tenantId}/${transferNumber}.pdf`;

  const { error } = await supabaseAdmin.storage
    .from(SUPABASE_PDF_BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true, // Allow regeneration
      cacheControl: '31536000', // 1 year cache
    });

  if (error) {
    throw Errors.internal(`Failed to upload PDF to storage: ${error.message}`);
  }

  // Get public URL (for private buckets, this still works but requires auth)
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(SUPABASE_PDF_BUCKET)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

/**
 * Generate and upload dispatch note PDF for stock transfer
 */
export async function generateDispatchNotePdf(data: DispatchNoteData): Promise<string> {
  // Generate HTML from template
  const html = generateDispatchNoteHtml(data);

  // Generate PDF using Puppeteer
  const pdfBuffer = await generatePdfFromHtml(html);

  // Upload to Supabase Storage
  const publicUrl = await uploadPdfToStorage({
    tenantId: data.tenantBranding.overridesJson?.tenantId || 'unknown', // Fallback
    transferNumber: data.transferNumber,
    pdfBuffer,
  });

  return publicUrl;
}

/**
 * Download PDF from Supabase Storage
 * Used for serving PDFs via API endpoint
 */
export async function downloadPdfFromStorage(filePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(SUPABASE_PDF_BUCKET).download(filePath);

  if (error) {
    throw Errors.notFound(`PDF not found: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract file path from Supabase public URL
 * Example: https://xxx.supabase.co/storage/v1/object/public/stock-transfer-pdfs/tenant_123/TRF-2025-0001.pdf
 * Returns: tenant_123/TRF-2025-0001.pdf
 */
export function extractFilePathFromUrl(url: string): string {
  const parts = url.split(`/${SUPABASE_PDF_BUCKET}/`);
  if (parts.length < 2 || !parts[1]) {
    throw Errors.validation('Invalid PDF URL format');
  }
  return parts[1];
}
