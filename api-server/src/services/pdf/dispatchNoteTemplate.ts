// api-server/src/services/pdf/dispatchNoteTemplate.ts
import { formatDate, formatDateTime, formatCurrency, escapeHtml, getPrimaryColor } from './pdfHelpers.js';

export interface DispatchNoteData {
  transferNumber: string;
  sourceBranch: {
    name: string;
  };
  destinationBranch: {
    name: string;
  };
  shippedAt: Date | string;
  shippedByUser: {
    fullName: string;
  };
  items: Array<{
    productName: string;
    sku: string;
    qtyShipped: number;
    avgUnitCostPence?: number;
  }>;
  tenantBranding: {
    logoUrl?: string | null;
    overridesJson?: any;
  };
  tenantName: string;
}

/**
 * Generate HTML template for stock transfer dispatch note
 */
export function generateDispatchNoteHtml(data: DispatchNoteData): string {
  const primaryColor = getPrimaryColor(data.tenantBranding.overridesJson);
  const shippedDate = formatDate(data.shippedAt);
  const shippedTime = formatDateTime(data.shippedAt);

  // Calculate total items
  const totalQty = data.items.reduce((sum, item) => sum + item.qtyShipped, 0);

  // Generate rows for items table
  const itemRows = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${escapeHtml(item.productName)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${escapeHtml(item.sku)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right;">${item.qtyShipped}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right;">${
        item.avgUnitCostPence ? formatCurrency(item.avgUnitCostPence) : '-'
      }</td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dispatch Note - ${escapeHtml(data.transferNumber)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #212529;
      padding: 40px;
      background: white;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${primaryColor};
    }

    .logo-section {
      flex: 1;
    }

    .logo {
      max-width: 200px;
      max-height: 80px;
    }

    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: ${primaryColor};
      margin-top: 10px;
    }

    .document-info {
      text-align: right;
    }

    .document-title {
      font-size: 28px;
      font-weight: 700;
      color: #212529;
      margin-bottom: 8px;
    }

    .transfer-number {
      font-size: 16px;
      color: #495057;
      margin-bottom: 4px;
    }

    .date {
      font-size: 12px;
      color: #868e96;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #212529;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #dee2e6;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }

    .info-box {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid ${primaryColor};
    }

    .info-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #868e96;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 14px;
      color: #212529;
      font-weight: 600;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    thead {
      background: ${primaryColor};
      color: white;
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    th:nth-child(3),
    th:nth-child(4) {
      text-align: right;
    }

    tbody tr:hover {
      background: #f8f9fa;
    }

    .summary {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .summary-label {
      font-size: 12px;
      color: #495057;
      font-weight: 600;
    }

    .summary-value {
      font-size: 16px;
      color: ${primaryColor};
      font-weight: 700;
    }

    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      font-size: 10px;
      color: #868e96;
      text-align: center;
    }

    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      ${
        data.tenantBranding.logoUrl
          ? `<img src="${escapeHtml(data.tenantBranding.logoUrl)}" alt="Logo" class="logo" />`
          : `<div class="company-name">${escapeHtml(data.tenantName)}</div>`
      }
    </div>
    <div class="document-info">
      <div class="document-title">Dispatch Note</div>
      <div class="transfer-number">${escapeHtml(data.transferNumber)}</div>
      <div class="date">${shippedDate}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">From (Source Branch)</div>
      <div class="info-value">${escapeHtml(data.sourceBranch.name)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">To (Destination Branch)</div>
      <div class="info-value">${escapeHtml(data.destinationBranch.name)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Shipment Details</div>
    <table>
      <thead>
        <tr>
          <th>Product Name</th>
          <th>SKU</th>
          <th>Quantity Shipped</th>
          <th>Unit Cost</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">Total Items Shipped:</span>
        <span class="summary-value">${totalQty}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Shipment Information</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div class="info-label">Shipped By</div>
        <div style="font-size: 13px; color: #212529;">${escapeHtml(data.shippedByUser.fullName)}</div>
      </div>
      <div>
        <div class="info-label">Shipped Date & Time</div>
        <div style="font-size: 13px; color: #212529;">${shippedTime}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>This is an electronically generated dispatch note for stock transfer ${escapeHtml(data.transferNumber)}.</p>
    <p>Generated on ${new Date().toLocaleString('en-GB')}</p>
  </div>
</body>
</html>
  `.trim();
}
