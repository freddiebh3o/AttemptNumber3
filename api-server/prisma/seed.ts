// api-server/prisma/seed.ts
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { provisionTenantRBAC, ensurePermissionCatalog } from '../src/services/role/roleProvisioningService.js';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

type SlimBranch = { id: string; branchSlug: string };
type SeededUser = { id: string; userEmailAddress: string };
type SeededUsers = {
  owner: SeededUser;
  admin: SeededUser;
  editor: SeededUser;
  viewer: SeededUser;
  mixed:  SeededUser;
};

async function upsertManyProductsForTenant(opts: {
  tenantId: string;
  tenantPrefix: 'ACME' | 'GLOBEX';
  startIndex: number;
  count: number;
}) {
  const { tenantId, tenantPrefix, startIndex, count } = opts;
  const pad3 = (n: number) => String(n).padStart(3, '0');

  const batchSize = 50;
  for (let offset = 0; offset < count; offset += batchSize) {
    const batchEnd = Math.min(offset + batchSize, count);
    await Promise.all(
      Array.from({ length: batchEnd - offset }).map((_, i) => {
        const n = startIndex + offset + i;
        const productSku = `${tenantPrefix}-SKU-${pad3(n)}`;
        const productName = `${tenantPrefix} Product ${n}`;
        // Store price in **pence**
        const productPricePence = 199 + ((n * 137) % 97501);
        return prisma.product.upsert({
          where: { tenantId_productSku: { tenantId, productSku } },
          update: { productName, productPricePence },
          create: { tenantId, productName, productSku, productPricePence },
          select: { id: true },
        });
      })
    );
  }
}

async function getRoleId(tenantId: string, name: 'OWNER'|'ADMIN'|'EDITOR'|'VIEWER') {
  const r = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name } },
    select: { id: true },
  });
  if (!r) throw new Error(`Role not found for tenantId=${tenantId} name=${name}`);
  return r.id;
}

async function upsertUser(email: string, hashed: string) {
  return prisma.user.upsert({
    where: { userEmailAddress: email },
    update: {},
    create: { userEmailAddress: email, userHashedPassword: hashed },
    select: { id: true, userEmailAddress: true },
  });
}

async function upsertMembershipWithRole(userId: string, tenantId: string, roleId: string) {
  await prisma.userTenantMembership.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { roleId },
    create: { userId, tenantId, roleId },
  });
}

async function seedTenantsAndRBAC() {
  // Ensure the global permission catalogue includes all current keys
  await ensurePermissionCatalog(prisma);

  const acme = await prisma.tenant.upsert({
    where: { tenantSlug: 'acme' },
    update: {},
    create: { tenantSlug: 'acme', tenantName: 'Acme Incorporated' },
  });
  await provisionTenantRBAC(acme.id, prisma); // ensures/aligns system roles

  const globex = await prisma.tenant.upsert({
    where: { tenantSlug: 'globex' },
    update: {},
    create: { tenantSlug: 'globex', tenantName: 'Globex Corporation' },
  });
  await provisionTenantRBAC(globex.id, prisma);

  return { acmeId: acme.id, globexId: globex.id };
}

async function seedProducts(acmeId: string, globexId: string) {
  // Hand-authored examples (prices in **pence**)
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeId, productSku: 'ACME-SKU-001' } },
    update: { productName: 'Acme Anvil', productPricePence: 1999 },
    create: { tenantId: acmeId, productName: 'Acme Anvil', productSku: 'ACME-SKU-001', productPricePence: 1999 },
  });
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeId, productSku: 'ACME-SKU-002' } },
    update: { productName: 'Acme Rocket Skates', productPricePence: 4999 },
    create: { tenantId: acmeId, productName: 'Acme Rocket Skates', productSku: 'ACME-SKU-002', productPricePence: 4999 },
  });

  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: globexId, productSku: 'GLOBEX-SKU-001' } },
    update: { productName: 'Globex Heat Lamp', productPricePence: 2999 },
    create: { tenantId: globexId, productName: 'Globex Heat Lamp', productSku: 'GLOBEX-SKU-001', productPricePence: 2999 },
  });
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: globexId, productSku: 'GLOBEX-SKU-002' } },
    update: { productName: 'Globex Shrink Ray', productPricePence: 9999 },
    create: { tenantId: globexId, productName: 'Globex Shrink Ray', productSku: 'GLOBEX-SKU-002', productPricePence: 9999 },
  });

  // Bulk for pagination testing
  await upsertManyProductsForTenant({ tenantId: acmeId, tenantPrefix: 'ACME', startIndex: 100, count: 150 });
  await upsertManyProductsForTenant({ tenantId: globexId, tenantPrefix: 'GLOBEX', startIndex: 100, count: 120 });
}

async function seedTestUsers(acmeId: string, globexId: string): Promise<SeededUsers> {
  const [ownerId, adminId, editorId, viewerId] = await Promise.all([
    getRoleId(acmeId, 'OWNER'),
    getRoleId(acmeId, 'ADMIN'),
    getRoleId(acmeId, 'EDITOR'),
    getRoleId(acmeId, 'VIEWER'),
  ]);
  const [globexViewerId, globexEditorId] = await Promise.all([
    getRoleId(globexId, 'VIEWER'),
    getRoleId(globexId, 'EDITOR'),
  ]);

  const hashed = await bcrypt.hash(PASSWORD, 10);

  const [uOwner, uAdmin, uEditor, uViewer, uMixed] = await Promise.all([
    upsertUser('owner@acme.test',  hashed),
    upsertUser('admin@acme.test',  hashed),
    upsertUser('editor@acme.test', hashed),
    upsertUser('viewer@acme.test', hashed),
    upsertUser('mixed@both.test',  hashed),
  ]);

  await Promise.all([
    upsertMembershipWithRole(uOwner.id,  acmeId, ownerId),
    upsertMembershipWithRole(uAdmin.id,  acmeId, adminId),
    upsertMembershipWithRole(uEditor.id, acmeId, editorId),
    upsertMembershipWithRole(uViewer.id, acmeId, viewerId),

    upsertMembershipWithRole(uMixed.id, acmeId,   editorId),
    upsertMembershipWithRole(uMixed.id, globexId, globexViewerId),

    upsertMembershipWithRole(uEditor.id, globexId, globexEditorId),
  ]);

  console.log('--- Test users seeded ---');
  console.table([
    { email: 'owner@acme.test',  tenant: 'acme',   role: 'OWNER'  },
    { email: 'admin@acme.test',  tenant: 'acme',   role: 'ADMIN'  },
    { email: 'editor@acme.test', tenant: 'acme',   role: 'EDITOR' },
    { email: 'viewer@acme.test', tenant: 'acme',   role: 'VIEWER' },
    { email: 'mixed@both.test',  tenant: 'acme',   role: 'EDITOR' },
    { email: 'mixed@both.test',  tenant: 'globex', role: 'VIEWER' },
  ]);
  console.log('Password for all test users:', PASSWORD);

  return {
    owner: uOwner,
    admin: uAdmin,
    editor: uEditor,
    viewer: uViewer,
    mixed:  uMixed,
  };
}

async function upsertBranchesForTenant(tenantId: string, slugPrefix: 'acme' | 'globex') {
  const defs = [
    { branchSlug: `${slugPrefix}-hq`,        branchName: 'HQ' },
    { branchSlug: `${slugPrefix}-warehouse`, branchName: 'Warehouse' },
    { branchSlug: `${slugPrefix}-retail-1`,  branchName: 'Retail #1' },
  ];
  const rows: SlimBranch[] = [];
  for (const d of defs) {
    const row = await prisma.branch.upsert({
      where: { tenantId_branchSlug: { tenantId, branchSlug: d.branchSlug } },
      update: { branchName: d.branchName, isActive: true },
      create: { tenantId, ...d, isActive: true },
      select: { id: true, branchSlug: true },
    });
    rows.push(row);
  }
  return rows; // [{id, branchSlug}, ...]
}

async function addUserToBranches(userId: string, tenantId: string, branchIds: string[]) {
  for (const branchId of branchIds) {
    await prisma.userBranchMembership.upsert({
      where: { userId_branchId: { userId, branchId } },
      update: {},
      create: { userId, tenantId, branchId },
    });
  }
}

async function seedStockTransfers(
  acmeId: string,
  users: SeededUsers,
  acmeBranches: SlimBranch[]
) {
  // Helper to find branch by slug
  const mustFind = (list: SlimBranch[], slug: string) => {
    const b = list.find(x => x.branchSlug === slug);
    if (!b) throw new Error(`Branch not found: ${slug}`);
    return b;
  };

  const acmeWarehouse = mustFind(acmeBranches, 'acme-warehouse');
  const acmeRetail1 = mustFind(acmeBranches, 'acme-retail-1');

  // Get some products for the transfers
  const products = await prisma.product.findMany({
    where: {
      tenantId: acmeId,
      productSku: { in: ['ACME-SKU-001', 'ACME-SKU-002'] },
    },
    select: { id: true, productSku: true },
  });

  if (products.length < 2) {
    console.log('Skipping stock transfer seed: not enough products');
    return;
  }

  const product1 = products.find(p => p.productSku === 'ACME-SKU-001')!;
  const product2 = products.find(p => p.productSku === 'ACME-SKU-002')!;

  // Create a COMPLETED transfer (for demo/testing)
  await prisma.stockTransfer.upsert({
    where: {
      tenantId_transferNumber: {
        tenantId: acmeId,
        transferNumber: 'TRF-2025-001',
      },
    },
    update: {},
    create: {
      tenantId: acmeId,
      transferNumber: 'TRF-2025-001',
      sourceBranchId: acmeWarehouse.id,
      destinationBranchId: acmeRetail1.id,
      status: 'COMPLETED',
      requestedByUserId: users.viewer.id, // viewer at retail-1
      reviewedByUserId: users.admin.id, // admin at warehouse
      shippedByUserId: users.admin.id,
      requestedAt: new Date('2025-01-15T09:00:00Z'),
      reviewedAt: new Date('2025-01-15T10:30:00Z'),
      shippedAt: new Date('2025-01-15T14:00:00Z'),
      completedAt: new Date('2025-01-16T09:00:00Z'),
      requestNotes: 'Stock running low at retail store',
      items: {
        create: [
          {
            productId: product1.id,
            qtyRequested: 50,
            qtyApproved: 50,
            qtyShipped: 50,
            qtyReceived: 50,
            avgUnitCostPence: 1200,
          },
        ],
      },
    },
  });

  // Create an IN_TRANSIT transfer
  await prisma.stockTransfer.upsert({
    where: {
      tenantId_transferNumber: {
        tenantId: acmeId,
        transferNumber: 'TRF-2025-002',
      },
    },
    update: {},
    create: {
      tenantId: acmeId,
      transferNumber: 'TRF-2025-002',
      sourceBranchId: acmeWarehouse.id,
      destinationBranchId: acmeRetail1.id,
      status: 'IN_TRANSIT',
      requestedByUserId: users.viewer.id,
      reviewedByUserId: users.admin.id,
      shippedByUserId: users.admin.id,
      requestedAt: new Date('2025-01-20T09:00:00Z'),
      reviewedAt: new Date('2025-01-20T11:00:00Z'),
      shippedAt: new Date('2025-01-20T15:00:00Z'),
      requestNotes: 'Restock for weekend rush',
      items: {
        create: [
          {
            productId: product2.id,
            qtyRequested: 30,
            qtyApproved: 30,
            qtyShipped: 30,
            qtyReceived: 0,
            avgUnitCostPence: 3500,
          },
        ],
      },
    },
  });

  // Create a REQUESTED transfer
  await prisma.stockTransfer.upsert({
    where: {
      tenantId_transferNumber: {
        tenantId: acmeId,
        transferNumber: 'TRF-2025-003',
      },
    },
    update: {},
    create: {
      tenantId: acmeId,
      transferNumber: 'TRF-2025-003',
      sourceBranchId: acmeWarehouse.id,
      destinationBranchId: acmeRetail1.id,
      status: 'REQUESTED',
      requestedByUserId: users.viewer.id,
      requestedAt: new Date('2025-01-22T09:00:00Z'),
      requestNotes: 'Monthly restock request',
      items: {
        create: [
          {
            productId: product1.id,
            qtyRequested: 100,
          },
          {
            productId: product2.id,
            qtyRequested: 75,
          },
        ],
      },
    },
  });

  console.log('--- Stock transfers seeded ---');
  console.log('TRF-2025-001: COMPLETED (Warehouse → Retail #1)');
  console.log('TRF-2025-002: IN_TRANSIT (Warehouse → Retail #1)');
  console.log('TRF-2025-003: REQUESTED (Warehouse → Retail #1)');
}

async function main() {
  // Tenants + RBAC
  const { acmeId, globexId } = await seedTenantsAndRBAC();

  const acmeBranches   = await upsertBranchesForTenant(acmeId, 'acme');
  const globexBranches = await upsertBranchesForTenant(globexId, 'globex');

  // Products
  await seedProducts(acmeId, globexId);

  // Users + memberships (includes an OWNER → has roles:manage)
  const users = await seedTestUsers(acmeId, globexId);

  // Pick specific branches (helpers to throw if not found)
  const mustFind = (list: SlimBranch[], slug: string) => {
    const b = list.find(x => x.branchSlug === slug);
    if (!b) throw new Error(`Branch not found: ${slug}`);
    return b;
  };

  const acmeHQ        = mustFind(acmeBranches, 'acme-hq');
  const acmeWarehouse = mustFind(acmeBranches, 'acme-warehouse');
  const acmeRetail1   = mustFind(acmeBranches, 'acme-retail-1');
  const globexHQ      = mustFind(globexBranches, 'globex-hq');

  await addUserToBranches(users.owner.id, acmeId, [acmeHQ.id, acmeWarehouse.id, acmeRetail1.id]);
  await addUserToBranches(users.admin.id, acmeId, [acmeHQ.id, acmeWarehouse.id]);
  await addUserToBranches(users.editor.id, acmeId, [acmeHQ.id]);
  await addUserToBranches(users.viewer.id, acmeId, [acmeRetail1.id]);
  await addUserToBranches(users.mixed.id, acmeId,   [acmeHQ.id]);
  await addUserToBranches(users.mixed.id, globexId, [globexHQ.id]);   // and globex

  // Stock transfers
  await seedStockTransfers(acmeId, users, acmeBranches);

  console.log('Seed complete. Tenants: acme, globex');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
