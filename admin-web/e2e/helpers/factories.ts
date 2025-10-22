import type { Page } from '@playwright/test';
import { getApiUrl, getCookieHeader, makeAuthenticatedRequest } from './api-helpers';

/**
 * Product factory for creating, archiving, and deleting products in E2E tests
 */
export const ProductFactory = {
  /**
   * Create a product via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Product creation parameters
   * @returns Product ID
   *
   * @example
   * ```typescript
   * const productId = await ProductFactory.create(page, {
   *   productName: 'Test Product',
   *   productSku: `TEST-${Date.now()}`,
   *   productPricePence: 1000,
   *   barcode: '1234567890',
   *   barcodeType: 'EAN13',
   * });
   * ```
   */
  async create(
    page: Page,
    params: {
      productName: string;
      productSku: string;
      productPricePence: number;
      barcode?: string;
      barcodeType?: string;
    }
  ): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'POST', '/api/products', params);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create product: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    // Handle both response formats: data.data.id and data.data.product.id
    return data.data.id || data.data.product?.id;
  },

  /**
   * Archive a product via API (soft delete)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param productId - Product ID to archive
   *
   * @example
   * ```typescript
   * await ProductFactory.archive(page, productId);
   * ```
   */
  async archive(page: Page, productId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/products/${productId}`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to archive product: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Restore an archived product via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param productId - Product ID to restore
   *
   * @example
   * ```typescript
   * await ProductFactory.restore(page, productId);
   * ```
   */
  async restore(page: Page, productId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'POST', `/api/products/${productId}/restore`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to restore product: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Delete a product via API (alias for archive for backward compatibility)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param productId - Product ID to delete
   *
   * @example
   * ```typescript
   * await ProductFactory.delete(page, productId);
   * ```
   */
  async delete(page: Page, productId: string): Promise<void> {
    return this.archive(page, productId);
  },

  /**
   * Get the first product ID for the authenticated tenant
   *
   * @param page - Playwright page object (must be authenticated)
   * @returns First product ID
   *
   * @example
   * ```typescript
   * const productId = await ProductFactory.getFirst(page);
   * ```
   */
  async getFirst(page: Page): Promise<string> {
    const apiUrl = getApiUrl();
    const cookieHeader = await getCookieHeader(page);

    const response = await page.request.get(`${apiUrl}/api/products`, {
      headers: { 'Cookie': cookieHeader },
    });

    if (!response.ok()) {
      throw new Error(`Failed to fetch products: ${response.status()}`);
    }

    const data = await response.json();
    if (data.data.items.length < 1) {
      throw new Error('No products found');
    }

    return data.data.items[0].id;
  },
};

/**
 * Branch factory for creating, archiving, and managing branches in E2E tests
 */
export const BranchFactory = {
  /**
   * Create a branch via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Branch creation parameters
   * @returns Branch ID
   *
   * @example
   * ```typescript
   * const branchId = await BranchFactory.create(page, {
   *   branchSlug: 'test-branch',
   *   branchName: 'Test Branch',
   *   isActive: true,
   * });
   * ```
   */
  async create(
    page: Page,
    params: {
      branchSlug: string;
      branchName: string;
      isActive?: boolean;
    }
  ): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'POST', '/api/branches', {
      branchSlug: params.branchSlug,
      branchName: params.branchName,
      isActive: params.isActive ?? true,
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create branch: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data.branch.id;
  },

  /**
   * Add current user to a branch
   * This is required for the user to perform operations on the branch
   *
   * @param page - Playwright page object (must be authenticated as owner/admin with users:manage permission)
   * @param branchId - Branch ID to add the user to
   *
   * @example
   * ```typescript
   * const branchId = await BranchFactory.create(page, { branchSlug: 'test', branchName: 'Test' });
   * await BranchFactory.addCurrentUserToBranch(page, branchId);
   * ```
   */
  async addCurrentUserToBranch(page: Page, branchId: string): Promise<void> {
    // Get current user info
    const meResponse = await makeAuthenticatedRequest(page, 'GET', '/api/auth/me');
    if (!meResponse.ok()) {
      throw new Error(`Failed to get current user: ${meResponse.status()}`);
    }
    const meData = await meResponse.json();
    const userId = meData.data.user.id;
    const currentBranchIds = meData.data.branchMembershipsCurrentTenant.map((b: any) => b.branchId);

    // Add new branch to user's branch list
    const newBranchIds = [...currentBranchIds, branchId];

    const updateResponse = await makeAuthenticatedRequest(
      page,
      'PUT',
      `/api/tenant-users/${userId}`,
      { branchIds: newBranchIds }
    );

    if (!updateResponse.ok()) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to add user to branch: ${updateResponse.status()} - ${errorText}`);
    }
  },

  /**
   * Archive a branch via API (soft delete)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param branchId - Branch ID to archive
   *
   * @example
   * ```typescript
   * await BranchFactory.archive(page, branchId);
   * ```
   */
  async archive(page: Page, branchId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/branches/${branchId}`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to archive branch: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Restore an archived branch via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param branchId - Branch ID to restore
   *
   * @example
   * ```typescript
   * await BranchFactory.restore(page, branchId);
   * ```
   */
  async restore(page: Page, branchId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'POST', `/api/branches/${branchId}/restore`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to restore branch: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Get the first branch ID for the authenticated tenant
   *
   * @param page - Playwright page object (must be authenticated)
   * @returns First branch ID
   *
   * @example
   * ```typescript
   * const branchId = await BranchFactory.getFirst(page);
   * ```
   */
  async getFirst(page: Page): Promise<string> {
    const apiUrl = getApiUrl();
    const cookieHeader = await getCookieHeader(page);

    const response = await page.request.get(`${apiUrl}/api/branches`, {
      headers: { 'Cookie': cookieHeader },
    });

    if (!response.ok()) {
      throw new Error(`Failed to fetch branches: ${response.status()}`);
    }

    const data = await response.json();
    if (data.data.items.length < 1) {
      throw new Error('No branches found');
    }

    return data.data.items[0].id;
  },

  /**
   * Get the second branch ID for the authenticated tenant (or first if only one exists)
   *
   * @param page - Playwright page object (must be authenticated)
   * @returns Second branch ID (or first if only one exists)
   *
   * @example
   * ```typescript
   * const destBranchId = await BranchFactory.getSecond(page);
   * ```
   */
  async getSecond(page: Page): Promise<string> {
    const apiUrl = getApiUrl();
    const cookieHeader = await getCookieHeader(page);

    const response = await page.request.get(`${apiUrl}/api/branches`, {
      headers: { 'Cookie': cookieHeader },
    });

    if (!response.ok()) {
      throw new Error(`Failed to fetch branches: ${response.status()}`);
    }

    const data = await response.json();
    if (data.data.items.length < 1) {
      throw new Error('No branches found');
    }

    // Return second branch if available, otherwise return first
    return data.data.items.length > 1 ? data.data.items[1].id : data.data.items[0].id;
  },

  /**
   * Get all branches for the authenticated tenant
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Optional filter parameters
   * @returns Array of branch objects with id and branchName
   *
   * @example
   * ```typescript
   * const branches = await BranchFactory.getAll(page);
   * const allBranches = await BranchFactory.getAll(page, { archivedFilter: 'all' });
   * ```
   */
  async getAll(
    page: Page,
    params?: {
      archivedFilter?: 'active-only' | 'archived-only' | 'all';
    }
  ): Promise<Array<{ id: string; branchName: string; isArchived?: boolean }>> {
    const apiUrl = getApiUrl();
    const cookieHeader = await getCookieHeader(page);

    const search = new URLSearchParams();
    if (params?.archivedFilter) {
      search.set('archivedFilter', params.archivedFilter);
    }

    const qs = search.toString();
    const response = await page.request.get(
      `${apiUrl}/api/branches${qs ? `?${qs}` : ''}`,
      {
        headers: { 'Cookie': cookieHeader },
      }
    );

    if (!response.ok()) {
      throw new Error(`Failed to fetch branches: ${response.status()}`);
    }

    const data = await response.json();
    return data.data.items;
  },

  /**
   * Get a branch by its slug
   *
   * @param page - Playwright page object (must be authenticated)
   * @param slug - Branch slug to find
   * @returns Branch ID
   * @throws Error if branch not found
   *
   * @example
   * ```typescript
   * const warehouseId = await BranchFactory.getBySlug(page, 'acme-warehouse');
   * ```
   */
  async getBySlug(page: Page, slug: string): Promise<string> {
    const branches = await this.getAll(page);
    const branch = branches.find((b: any) => b.branchSlug === slug);

    if (!branch) {
      throw new Error(`Branch not found with slug: ${slug}`);
    }

    return branch.id;
  },
};

/**
 * Stock factory for creating stock records and adjustments in E2E tests
 */
export const StockFactory = {
  /**
   * Create a product with initial stock via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param productParams - Product creation parameters (optional, uses defaults if not provided)
   * @returns Object with productId and branchId
   *
   * @example
   * ```typescript
   * const { productId, branchId } = await StockFactory.createProductWithStock(page);
   * // Or specify a branch:
   * const result = await StockFactory.createProductWithStock(page, { branchId: 'branch-123' });
   * ```
   */
  async createProductWithStock(
    page: Page,
    productParams?: {
      productName?: string;
      productSku?: string;
      productPricePence?: number;
      initialQty?: number;
      unitCostPence?: number;
      branchId?: string;
      branchSlug?: string;
    }
  ): Promise<{ productId: string; branchId: string }> {
    const timestamp = Date.now();
    const params = {
      productName: productParams?.productName || `E2E Stock Test ${timestamp}`,
      productSku: productParams?.productSku || `STOCK-${timestamp}`,
      productPricePence: productParams?.productPricePence || 1000,
    };

    // Create product
    const productId = await ProductFactory.create(page, params);

    // Get branch ID - prioritize explicit branchId, then branchSlug, then default to seeded warehouse
    let branchId: string;
    if (productParams?.branchId) {
      branchId = productParams.branchId;
    } else if (productParams?.branchSlug) {
      branchId = await BranchFactory.getBySlug(page, productParams.branchSlug);
    } else {
      // Default to seeded warehouse branch (owner has access to this)
      branchId = await BranchFactory.getBySlug(page, 'acme-warehouse');
    }

    // Add initial stock
    const adjustResponse = await makeAuthenticatedRequest(page, 'POST', '/api/stock/adjust', {
      productId,
      branchId,
      qtyDelta: productParams?.initialQty || 20,
      unitCostPence: productParams?.unitCostPence || 100,
      reason: 'E2E test setup',
    });

    if (!adjustResponse.ok()) {
      const errorText = await adjustResponse.text();
      throw new Error(`Failed to adjust stock: ${adjustResponse.status()} - ${errorText}`);
    }

    return { productId, branchId };
  },

  /**
   * Add stock to a product at a branch via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Stock adjustment parameters
   *
   * @example
   * ```typescript
   * await StockFactory.addStock(page, {
   *   productId: 'prod-123',
   *   branchId: 'branch-456',
   *   qtyDelta: 100,
   *   unitCostPence: 500,
   *   reason: 'Initial stock',
   * });
   * ```
   */
  async addStock(
    page: Page,
    params: {
      productId: string;
      branchId: string;
      qtyDelta: number;
      unitCostPence: number;
      reason?: string;
    }
  ): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'POST', '/api/stock/adjust', {
      productId: params.productId,
      branchId: params.branchId,
      qtyDelta: params.qtyDelta,
      unitCostPence: params.unitCostPence,
      reason: params.reason || 'E2E test stock adjustment',
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to add stock: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Get stock lots for a product at a branch via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Query parameters
   * @returns Stock lots data including productStock and lots array
   *
   * @example
   * ```typescript
   * const stockData = await StockFactory.getLots(page, {
   *   productId: 'prod-123',
   *   branchId: 'branch-456',
   * });
   *
   * console.log(stockData.productStock.qtyOnHand); // Total quantity
   * console.log(stockData.lots); // Array of lots with receivedAt, qtyRemaining, etc.
   * ```
   */
  async getLots(
    page: Page,
    params: {
      productId: string;
      branchId: string;
    }
  ): Promise<{
    productStock: {
      qtyOnHand: number;
      qtyAllocated: number;
    };
    lots: Array<{
      id: string;
      receivedAt: string;
      qtyRemaining: number;
      unitCostPence: number;
    }>;
  }> {
    const response = await makeAuthenticatedRequest(
      page,
      'GET',
      `/api/stock/levels?productId=${params.productId}&branchId=${params.branchId}`
    );

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to get stock lots: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Get stock ledger entries for a product at a branch via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Query parameters
   * @returns Stock ledger entries
   *
   * @example
   * ```typescript
   * const ledger = await StockFactory.getLedger(page, {
   *   productId: 'prod-123',
   *   branchId: 'branch-456',
   *   kinds: 'REVERSAL',
   * });
   * ```
   */
  async getLedger(
    page: Page,
    params: {
      productId: string;
      branchId?: string;
      kinds?: string;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      kind: string;
      qtyDelta: number;
      occurredAt: string;
      reason?: string;
    }>;
  }> {
    const queryParams = new URLSearchParams({
      productId: params.productId,
    });

    if (params.branchId) queryParams.set('branchId', params.branchId);
    if (params.kinds) queryParams.set('kinds', params.kinds);
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const response = await makeAuthenticatedRequest(
      page,
      'GET',
      `/api/stock/ledger?${queryParams.toString()}`
    );

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to get stock ledger: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data;
  },
};

/**
 * Transfer template factory for creating and deleting templates in E2E tests
 */
export const TransferTemplateFactory = {
  /**
   * Create a transfer template via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Template creation parameters
   * @returns Template ID
   *
   * @example
   * ```typescript
   * const templateId = await TransferTemplateFactory.create(page, {
   *   name: 'Test Template',
   *   sourceBranchId: 'branch-1',
   *   destinationBranchId: 'branch-2',
   *   items: [{ productId: 'prod-1', defaultQty: 10 }],
   * });
   * ```
   */
  async create(
    page: Page,
    params: {
      name: string;
      description?: string;
      sourceBranchId: string;
      destinationBranchId: string;
      items: Array<{ productId: string; defaultQty: number }>;
    }
  ): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'POST', '/api/stock-transfer-templates', params);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create template: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data.id;
  },

  /**
   * Archive a transfer template via API (soft delete)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param templateId - Template ID to archive
   *
   * @example
   * ```typescript
   * await TransferTemplateFactory.archive(page, templateId);
   * ```
   */
  async archive(page: Page, templateId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/stock-transfer-templates/${templateId}`);

    if (!response.ok()) {
      const errorText = await response.text();
      // Ignore "already archived" errors for idempotency in cleanup
      if (errorText.includes('already archived')) {
        return;
      }
      throw new Error(`Failed to archive template: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Restore an archived transfer template via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param templateId - Template ID to restore
   *
   * @example
   * ```typescript
   * await TransferTemplateFactory.restore(page, templateId);
   * ```
   */
  async restore(page: Page, templateId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'POST', `/api/stock-transfer-templates/${templateId}/restore`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to restore template: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Delete a transfer template via API (alias for archive for backward compatibility)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param templateId - Template ID to delete
   *
   * @example
   * ```typescript
   * await TransferTemplateFactory.delete(page, templateId);
   * ```
   */
  async delete(page: Page, templateId: string): Promise<void> {
    return this.archive(page, templateId);
  },
};

/**
 * Transfer factory for creating and managing transfers in E2E tests
 */
export const TransferFactory = {
  /**
   * Create a transfer via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Transfer creation parameters
   * @returns Transfer ID
   *
   * @example
   * ```typescript
   * const transferId = await TransferFactory.create(page, {
   *   sourceBranchId: 'branch-1',
   *   destinationBranchId: 'branch-2',
   *   items: [{ productId: 'prod-1', qty: 10 }],
   * });
   * ```
   */
  async create(
    page: Page,
    params: {
      sourceBranchId: string;
      destinationBranchId: string;
      priority?: string;
      notes?: string;
      items: Array<{ productId: string; qty: number }>;
    }
  ): Promise<string> {
    // Transform items to match API schema (qty -> qtyRequested)
    const requestBody = {
      sourceBranchId: params.sourceBranchId,
      destinationBranchId: params.destinationBranchId,
      priority: params.priority,
      notes: params.notes,
      items: params.items.map(item => ({
        productId: item.productId,
        qtyRequested: item.qty,
      })),
    };

    const response = await makeAuthenticatedRequest(page, 'POST', '/api/stock-transfers', requestBody);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create transfer: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data.id;
  },

  /**
   * Get a transfer by ID via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param transferId - Transfer ID
   * @returns Transfer data
   *
   * @example
   * ```typescript
   * const transfer = await TransferFactory.getById(page, transferId);
   * ```
   */
  async getById(page: Page, transferId: string): Promise<any> {
    const response = await makeAuthenticatedRequest(page, 'GET', `/api/stock-transfers/${transferId}`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch transfer: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Approve a transfer via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param transferId - Transfer ID
   *
   * @example
   * ```typescript
   * await TransferFactory.approve(page, transferId);
   * ```
   */
  async approve(page: Page, transferId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(
      page,
      'PATCH',
      `/api/stock-transfers/${transferId}/review`,
      {
        action: 'approve',
      }
    );

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to approve transfer: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Ship a transfer via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Ship parameters
   *
   * @example
   * ```typescript
   * await TransferFactory.ship(page, {
   *   transferId: 'transfer-1',
   *   items: [{ itemId: 'item-1', qtyToShip: 10 }],
   * });
   * ```
   */
  async ship(
    page: Page,
    params: {
      transferId: string;
      shippedAt?: string;
      items: Array<{ itemId: string; qtyToShip: number }>;
    }
  ): Promise<void> {
    const response = await makeAuthenticatedRequest(
      page,
      'POST',
      `/api/stock-transfers/${params.transferId}/ship`,
      {
        shippedAt: params.shippedAt,
        items: params.items,
      }
    );

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to ship transfer: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Receive a transfer via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Receive parameters
   *
   * @example
   * ```typescript
   * await TransferFactory.receive(page, {
   *   transferId: 'transfer-1',
   *   items: [{ itemId: 'item-1', qtyReceived: 10 }],
   * });
   * ```
   */
  async receive(
    page: Page,
    params: {
      transferId: string;
      receivedAt?: string;
      items: Array<{ itemId: string; qtyReceived: number }>;
    }
  ): Promise<void> {
    const response = await makeAuthenticatedRequest(
      page,
      'POST',
      `/api/stock-transfers/${params.transferId}/receive`,
      {
        receivedAt: params.receivedAt,
        items: params.items,
      }
    );

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to receive transfer: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Create a transfer, add stock, approve, ship, and receive it (convenience method for testing)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Transfer setup parameters
   * @returns Transfer ID
   *
   * @example
   * ```typescript
   * const transferId = await TransferFactory.createAndShip(page, {
   *   sourceBranchId: 'branch-1',
   *   destinationBranchId: 'branch-2',
   *   productId: 'prod-1',
   *   quantity: 10,
   *   unitCostPence: 100,
   * });
   * ```
   */
  async createAndShip(
    page: Page,
    params: {
      sourceBranchId: string;
      destinationBranchId: string;
      productId: string;
      quantity: number;
      unitCostPence: number;
    }
  ): Promise<string> {
    // Add stock to source branch first
    await StockFactory.addStock(page, {
      productId: params.productId,
      branchId: params.sourceBranchId,
      qtyDelta: params.quantity,
      unitCostPence: params.unitCostPence,
      reason: 'E2E test: Setup for transfer',
    });

    // Create transfer
    const transferId = await this.create(page, {
      sourceBranchId: params.sourceBranchId,
      destinationBranchId: params.destinationBranchId,
      items: [{ productId: params.productId, qty: params.quantity }],
    });

    // Approve transfer
    await this.approve(page, transferId);

    // Get transfer details to get item IDs for shipping
    const transfer = await this.getById(page, transferId);

    // Ship transfer
    await this.ship(page, {
      transferId,
      items: transfer.items.map((item: any) => ({
        itemId: item.id,
        qtyToShip: item.qtyRequested,
      })),
    });

    // Receive transfer at destination (completes the transfer)
    const transferAfterShip = await this.getById(page, transferId);
    await this.receive(page, {
      transferId,
      items: transferAfterShip.items.map((item: any) => ({
        itemId: item.id,
        qtyReceived: item.qtyShipped,
      })),
    });

    return transferId;
  },

  /**
   * Delete a transfer via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param transferId - Transfer ID to delete
   *
   * @example
   * ```typescript
   * await TransferFactory.delete(page, transferId);
   * ```
   */
  async delete(page: Page, transferId: string): Promise<void> {
    if (!transferId) return;

    // Try to cancel first
    try {
      await makeAuthenticatedRequest(page, 'POST', `/api/stock-transfers/${transferId}/cancel`);
    } catch (error) {
      // Ignore - transfer may not be cancellable
    }

    // Then delete
    try {
      const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/stock-transfers/${transferId}`);
      if (!response.ok()) {
        console.log(`Failed to delete transfer ${transferId}`);
      }
    } catch (error) {
      console.log(`Failed to delete transfer ${transferId}:`, error);
    }
  },
};

/**
 * Approval rule factory for creating and managing approval rules in E2E tests
 */
export const ApprovalRuleFactory = {
  /**
   * Create an approval rule via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Approval rule creation parameters
   * @returns Approval rule ID
   *
   * @example
   * ```typescript
   * const ruleId = await ApprovalRuleFactory.create(page, {
   *   name: 'High Value Rule',
   *   isActive: true,
   *   approvalMode: 'SEQUENTIAL',
   *   priority: 1,
   *   conditions: [{ conditionType: 'TOTAL_VALUE_EXCEEDS', threshold: 10000 }],
   *   levels: [{ level: 1, name: 'Manager', requiredRoleId: 'role-1' }],
   * });
   * ```
   */
  async create(
    page: Page,
    params: {
      name: string;
      description: string;
      isActive: boolean;
      approvalMode: 'SEQUENTIAL' | 'PARALLEL' | 'HYBRID';
      priority: number;
      conditions: Array<{
        conditionType: string;
        threshold?: number;
        branchId?: string;
      }>;
      levels: Array<{
        level: number;
        name: string;
        requiredRoleId: string;
      }>;
    }
  ): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'POST', '/api/transfer-approval-rules', params);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create approval rule: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data.id;
  },

  /**
   * Archive an approval rule via API (soft delete)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param ruleId - Approval rule ID to archive
   *
   * @example
   * ```typescript
   * await ApprovalRuleFactory.archive(page, ruleId);
   * ```
   */
  async archive(page: Page, ruleId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/transfer-approval-rules/${ruleId}`);

    if (!response.ok()) {
      const errorText = await response.text();

      // Ignore "already archived" errors (idempotent operation)
      if (errorText.includes('already archived')) {
        return;
      }

      throw new Error(`Failed to archive approval rule: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Restore an archived approval rule via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param ruleId - Approval rule ID to restore
   *
   * @example
   * ```typescript
   * await ApprovalRuleFactory.restore(page, ruleId);
   * ```
   */
  async restore(page: Page, ruleId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'POST', `/api/transfer-approval-rules/${ruleId}/restore`);

    if (!response.ok()) {
      const errorText = await response.text();

      // Ignore "not archived" errors (idempotent operation)
      if (errorText.includes('not archived') || errorText.includes('already active')) {
        return;
      }

      throw new Error(`Failed to restore approval rule: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Delete an approval rule via API (alias for archive for backward compatibility)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param ruleId - Approval rule ID to delete
   *
   * @example
   * ```typescript
   * await ApprovalRuleFactory.delete(page, ruleId);
   * ```
   */
  async delete(page: Page, ruleId: string): Promise<void> {
    return this.archive(page, ruleId);
  },

  /**
   * Get all approval rules via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Optional filter parameters
   * @returns Array of approval rule objects
   *
   * @example
   * ```typescript
   * const rules = await ApprovalRuleFactory.getAll(page);
   * const archivedRules = await ApprovalRuleFactory.getAll(page, { archivedFilter: 'archived-only' });
   * ```
   */
  async getAll(
    page: Page,
    params?: {
      archivedFilter?: 'active-only' | 'archived-only' | 'all';
    }
  ): Promise<Array<{ id: string; name: string; isArchived?: boolean; isActive?: boolean }>> {
    const apiUrl = getApiUrl();
    const cookieHeader = await getCookieHeader(page);

    const search = new URLSearchParams();
    if (params?.archivedFilter) {
      search.set('archivedFilter', params.archivedFilter);
    }

    const qs = search.toString();
    const response = await page.request.get(
      `${apiUrl}/api/transfer-approval-rules${qs ? `?${qs}` : ''}`,
      {
        headers: { 'Cookie': cookieHeader },
      }
    );

    if (!response.ok()) {
      throw new Error(`Failed to fetch approval rules: ${response.status()}`);
    }

    const data = await response.json();
    return data.data.items;
  },
};

/**
 * Role factory for getting role information in E2E tests
 */
export const RoleFactory = {
  /**
   * Create a custom role via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Role creation parameters
   * @returns Role ID
   *
   * @example
   * ```typescript
   * const roleId = await RoleFactory.create(page, {
   *   name: 'Custom Manager',
   *   description: 'Manager role with specific permissions',
   *   permissionKeys: ['products:read', 'products:write'],
   * });
   * ```
   */
  async create(
    page: Page,
    params: {
      name: string;
      description?: string;
      permissionKeys?: string[];
    }
  ): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'POST', '/api/roles', params);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to create role: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data.role.id;
  },

  /**
   * Delete a role via API (archives it)
   * Silently ignores 409 CONFLICT errors (role already archived)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param roleId - Role ID to delete
   *
   * @example
   * ```typescript
   * await RoleFactory.delete(page, roleId);
   * ```
   */
  async delete(page: Page, roleId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/roles/${roleId}`);

    // Ignore 409 CONFLICT (role already archived) - this is expected in cleanup
    if (!response.ok() && response.status() !== 409) {
      const errorText = await response.text();
      throw new Error(`Failed to delete role: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Get a role ID by name via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param roleName - Role name (e.g., 'OWNER', 'ADMIN', 'EDITOR')
   * @returns Role ID
   *
   * @example
   * ```typescript
   * const roleId = await RoleFactory.getByName(page, 'OWNER');
   * ```
   */
  async getByName(page: Page, roleName: string): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'GET', '/api/roles');

    if (!response.ok()) {
      throw new Error(`Failed to fetch roles: ${response.status()}`);
    }

    const data = await response.json();

    if (!data.data || !data.data.items) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }

    const role = data.data.items.find((r: any) => r.name === roleName);
    if (!role) throw new Error(`Role not found: ${roleName}`);
    return role.id;
  },

  /**
   * Get the first role ID for the authenticated tenant
   *
   * @param page - Playwright page object (must be authenticated)
   * @returns First role ID
   *
   * @example
   * ```typescript
   * const roleId = await RoleFactory.getFirst(page);
   * ```
   */
  async getFirst(page: Page): Promise<string> {
    const response = await makeAuthenticatedRequest(page, 'GET', '/api/roles');

    if (!response.ok()) {
      throw new Error(`Failed to fetch roles: ${response.status()}`);
    }

    const data = await response.json();

    if (!data.data || !data.data.items || data.data.items.length === 0) {
      throw new Error('No roles found');
    }

    return data.data.items[0].id;
  },
};

/**
 * Tenant user factory for creating and managing tenant users in E2E tests
 */
export const TenantUserFactory = {
  /**
   * Get all tenant users via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param params - Optional filter parameters
   * @returns Array of user objects
   *
   * @example
   * ```typescript
   * const users = await TenantUserFactory.getAll(page);
   * const archivedUsers = await TenantUserFactory.getAll(page, { archivedFilter: 'archived-only' });
   * ```
   */
  async getAll(
    page: Page,
    params?: {
      archivedFilter?: 'active-only' | 'archived-only' | 'all';
    }
  ): Promise<Array<{ userId: string; userEmailAddress: string; isArchived?: boolean }>> {
    const apiUrl = getApiUrl();
    const cookieHeader = await getCookieHeader(page);

    const search = new URLSearchParams();
    if (params?.archivedFilter) {
      search.set('archivedFilter', params.archivedFilter);
    }

    const qs = search.toString();
    const response = await page.request.get(
      `${apiUrl}/api/tenant-users${qs ? `?${qs}` : ''}`,
      {
        headers: { 'Cookie': cookieHeader },
      }
    );

    if (!response.ok()) {
      throw new Error(`Failed to fetch tenant users: ${response.status()}`);
    }

    const data = await response.json();
    return data.data.items;
  },

  /**
   * Get a tenant user by ID via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param userId - User ID
   * @returns User object
   *
   * @example
   * ```typescript
   * const user = await TenantUserFactory.getById(page, userId);
   * ```
   */
  async getById(page: Page, userId: string): Promise<any> {
    const response = await makeAuthenticatedRequest(page, 'GET', `/api/tenant-users/${userId}`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch tenant user: ${response.status()} - ${errorText}`);
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Archive a tenant user membership via API (soft delete)
   *
   * @param page - Playwright page object (must be authenticated)
   * @param userId - User ID to archive
   *
   * @example
   * ```typescript
   * await TenantUserFactory.archive(page, userId);
   * ```
   */
  async archive(page: Page, userId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'DELETE', `/api/tenant-users/${userId}`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to archive user: ${response.status()} - ${errorText}`);
    }
  },

  /**
   * Restore an archived tenant user membership via API
   *
   * @param page - Playwright page object (must be authenticated)
   * @param userId - User ID to restore
   *
   * @example
   * ```typescript
   * await TenantUserFactory.restore(page, userId);
   * ```
   */
  async restore(page: Page, userId: string): Promise<void> {
    const response = await makeAuthenticatedRequest(page, 'POST', `/api/tenant-users/${userId}/restore`);

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(`Failed to restore user: ${response.status()} - ${errorText}`);
    }
  },
};

/**
 * Aggregated factories export for convenience
 *
 * @example
 * ```typescript
 * import { Factories } from './helpers';
 *
 * const productId = await Factories.product.create(page, { ... });
 * const branchId = await Factories.branch.getFirst(page);
 * const transferId = await Factories.transfer.create(page, { ... });
 * ```
 */
export const Factories = {
  product: ProductFactory,
  branch: BranchFactory,
  stock: StockFactory,
  template: TransferTemplateFactory,
  transfer: TransferFactory,
  approvalRule: ApprovalRuleFactory,
  role: RoleFactory,
  tenantUser: TenantUserFactory,
};
