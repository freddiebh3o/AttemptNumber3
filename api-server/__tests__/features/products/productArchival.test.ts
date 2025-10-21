// Product Archival Activity Log tests
import request from 'supertest';
import type { Express } from 'express';
import { createConfiguredExpressApplicationInstance } from '../../../src/app.js';
import {
  createTestUser,
  createTestTenant,
  createTestProduct,
  createTestRole,
  addUserToTenant,
  getPermissionsByKeys,
} from '../../helpers/factories.js';
import { createSessionCookie } from '../../helpers/auth.js';

describe('Product Archival Activity Log', () => {
  let app: Express;
  let tenantId: string;
  let ownerId: string;
  let productId: string;

  beforeAll(async () => {
    const { expressApplicationInstance } = createConfiguredExpressApplicationInstance();
    app = expressApplicationInstance;

    // Create tenant
    const tenant = await createTestTenant();
    tenantId = tenant.id;

    // Get permissions
    const productPerms = await getPermissionsByKeys(['products:read', 'products:write']);

    // Create role
    const ownerRole = await createTestRole({
      tenantId,
      name: 'OWNER',
      permissionIds: productPerms.map((p) => p.id),
    });

    // Create user
    const owner = await createTestUser();
    ownerId = owner.id;
    await addUserToTenant(ownerId, tenantId, ownerRole.id);

    // Create product
    const product = await createTestProduct({
      tenantId,
      name: 'Test Product for Activity',
      sku: 'ACTIVITY-001',
      pricePence: 1000,
    });
    productId = product.id;
  });

  it('should show "Archived product" message in activity log when archiving', async () => {
    // Archive the product
    await request(app)
      .delete(`/api/products/${productId}`)
      .set('Cookie', createSessionCookie(ownerId, tenantId));

    // Fetch activity log
    const response = await request(app)
      .get(`/api/products/${productId}/activity`)
      .set('Cookie', createSessionCookie(ownerId, tenantId));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Find the most recent archive event
    const archiveEvent = response.body.data.items.find(
      (item: any) => item.action === 'DELETE' && item.message === 'Archived product'
    );
    expect(archiveEvent).toBeDefined();
    expect(archiveEvent.messageParts?.archived).toEqual({
      before: false,
      after: true,
    });
  });

  it('should show "Restored product" message in activity log when restoring', async () => {
    // Restore the product
    await request(app)
      .post(`/api/products/${productId}/restore`)
      .set('Cookie', createSessionCookie(ownerId, tenantId));

    // Fetch activity log
    const response = await request(app)
      .get(`/api/products/${productId}/activity`)
      .set('Cookie', createSessionCookie(ownerId, tenantId));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Find the most recent restore event
    const restoreEvent = response.body.data.items.find(
      (item: any) => item.action === 'UPDATE' && item.message === 'Restored product'
    );
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent.messageParts?.archived).toEqual({
      before: true,
      after: false,
    });
  });
});
