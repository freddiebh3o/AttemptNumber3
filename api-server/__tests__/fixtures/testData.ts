/**
 * Test data fixtures
 * Predefined test data for common scenarios
 */

export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'adminpass123',
    name: 'Admin User',
  },
  editor: {
    email: 'editor@test.com',
    password: 'editorpass123',
    name: 'Editor User',
  },
  viewer: {
    email: 'viewer@test.com',
    password: 'viewerpass123',
    name: 'Viewer User',
  },
  noAccess: {
    email: 'noaccess@test.com',
    password: 'noaccesspass123',
    name: 'No Access User',
  },
};

export const TEST_TENANTS = {
  acme: {
    name: 'Acme Corp',
    slug: 'acme-corp',
  },
  beta: {
    name: 'Beta Inc',
    slug: 'beta-inc',
  },
};

export const TEST_PRODUCTS = {
  widget: {
    name: 'Test Widget',
    sku: 'WIDGET-001',
    description: 'A test widget product',
    category: 'Widgets',
    unitPrice: 25.99,
  },
  gadget: {
    name: 'Test Gadget',
    sku: 'GADGET-001',
    description: 'A test gadget product',
    category: 'Gadgets',
    unitPrice: 49.99,
  },
  tool: {
    name: 'Test Tool',
    sku: 'TOOL-001',
    description: 'A test tool product',
    category: 'Tools',
    unitPrice: 15.99,
  },
};

export const TEST_BRANCHES = {
  warehouse: {
    name: 'Main Warehouse',
    code: 'WH-001',
    address: '123 Warehouse Street',
  },
  storefront: {
    name: 'Retail Storefront',
    code: 'STORE-001',
    address: '456 Main Street',
  },
};

export const TEST_PERMISSIONS = {
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  THEME_MANAGE: 'theme:manage',
  BRANCHES_READ: 'branches:read',
  BRANCHES_WRITE: 'branches:write',
  STOCK_READ: 'stock:read',
  STOCK_WRITE: 'stock:write',
  AUDIT_READ: 'audit:read',
  SYSTEM_ADMIN: 'system:admin',
};

/**
 * Standard role permission mappings for testing
 */
export const TEST_ROLE_PERMISSIONS = {
  OWNER: [
    TEST_PERMISSIONS.PRODUCTS_READ,
    TEST_PERMISSIONS.PRODUCTS_WRITE,
    TEST_PERMISSIONS.USERS_MANAGE,
    TEST_PERMISSIONS.ROLES_MANAGE,
    TEST_PERMISSIONS.THEME_MANAGE,
    TEST_PERMISSIONS.BRANCHES_READ,
    TEST_PERMISSIONS.BRANCHES_WRITE,
    TEST_PERMISSIONS.STOCK_READ,
    TEST_PERMISSIONS.STOCK_WRITE,
    TEST_PERMISSIONS.AUDIT_READ,
  ],
  ADMIN: [
    TEST_PERMISSIONS.PRODUCTS_READ,
    TEST_PERMISSIONS.PRODUCTS_WRITE,
    TEST_PERMISSIONS.USERS_MANAGE,
    TEST_PERMISSIONS.BRANCHES_READ,
    TEST_PERMISSIONS.BRANCHES_WRITE,
    TEST_PERMISSIONS.STOCK_READ,
    TEST_PERMISSIONS.STOCK_WRITE,
    TEST_PERMISSIONS.AUDIT_READ,
  ],
  EDITOR: [
    TEST_PERMISSIONS.PRODUCTS_READ,
    TEST_PERMISSIONS.PRODUCTS_WRITE,
    TEST_PERMISSIONS.BRANCHES_READ,
    TEST_PERMISSIONS.STOCK_READ,
    TEST_PERMISSIONS.STOCK_WRITE,
  ],
  VIEWER: [
    TEST_PERMISSIONS.PRODUCTS_READ,
    TEST_PERMISSIONS.BRANCHES_READ,
    TEST_PERMISSIONS.STOCK_READ,
    TEST_PERMISSIONS.AUDIT_READ,
  ],
};

/**
 * Sample stock lot data
 */
export const TEST_STOCK_LOTS = {
  lot1: {
    quantity: 100,
    unitCost: 10.0,
    receivedDate: new Date('2025-01-01'),
    referenceNumber: 'PO-001',
  },
  lot2: {
    quantity: 50,
    unitCost: 12.0,
    receivedDate: new Date('2025-01-15'),
    referenceNumber: 'PO-002',
  },
  lot3: {
    quantity: 75,
    unitCost: 11.5,
    receivedDate: new Date('2025-02-01'),
    referenceNumber: 'PO-003',
  },
};

/**
 * Error response structure for testing
 */
export const ERROR_RESPONSES = {
  UNAUTHORIZED: {
    success: false,
    data: null,
    error: {
      errorCode: 'UNAUTHORIZED',
      httpStatusCode: 401,
    },
  },
  FORBIDDEN: {
    success: false,
    data: null,
    error: {
      errorCode: 'FORBIDDEN',
      httpStatusCode: 403,
    },
  },
  NOT_FOUND: {
    success: false,
    data: null,
    error: {
      errorCode: 'NOT_FOUND',
      httpStatusCode: 404,
    },
  },
  VALIDATION_ERROR: {
    success: false,
    data: null,
    error: {
      errorCode: 'VALIDATION_ERROR',
      httpStatusCode: 400,
    },
  },
  CONFLICT: {
    success: false,
    data: null,
    error: {
      errorCode: 'CONFLICT',
      httpStatusCode: 409,
    },
  },
};

/**
 * Success response structure for testing
 */
export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}
