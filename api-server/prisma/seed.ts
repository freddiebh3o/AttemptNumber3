// api-server/prisma/seed.ts
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { provisionTenantRBAC, ensurePermissionCatalog } from '../src/services/roleProvisioningService.js';

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
        const productPriceCents = 199 + ((n * 137) % 97501);
        return prisma.product.upsert({
          where: { tenantId_productSku: { tenantId, productSku } },
          update: { productName, productPriceCents },
          create: { tenantId, productName, productSku, productPriceCents },
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
  // ⭐ NEW: ensure the global permission catalogue includes all current keys
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
  // Hand-authored examples
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeId, productSku: 'ACME-SKU-001' } },
    update: { productName: 'Acme Anvil', productPriceCents: 1999 },
    create: { tenantId: acmeId, productName: 'Acme Anvil', productSku: 'ACME-SKU-001', productPriceCents: 1999 },
  });
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeId, productSku: 'ACME-SKU-002' } },
    update: { productName: 'Acme Rocket Skates', productPriceCents: 4999 },
    create: { tenantId: acmeId, productName: 'Acme Rocket Skates', productSku: 'ACME-SKU-002', productPriceCents: 4999 },
  });

  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: globexId, productSku: 'GLOBEX-SKU-001' } },
    update: { productName: 'Globex Heat Lamp', productPriceCents: 2999 },
    create: { tenantId: globexId, productName: 'Globex Heat Lamp', productSku: 'GLOBEX-SKU-001', productPriceCents: 2999 },
  });
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: globexId, productSku: 'GLOBEX-SKU-002' } },
    update: { productName: 'Globex Shrink Ray', productPriceCents: 9999 },
    create: { tenantId: globexId, productName: 'Globex Shrink Ray', productSku: 'GLOBEX-SKU-002', productPriceCents: 9999 },
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

async function main() {
  // Tenants + RBAC
  const { acmeId, globexId } = await seedTenantsAndRBAC();

  const acmeBranches   = await upsertBranchesForTenant(acmeId, 'acme');
  const globexBranches = await upsertBranchesForTenant(globexId, 'globex');

  // Products
  await seedProducts(acmeId, globexId);

  // Users + memberships (includes an OWNER → has roles:manage)
  await seedTestUsers(acmeId, globexId);

  const users = await seedTestUsers(acmeId, globexId);

  // Pick specific branches (helpers to throw if not found)
  const mustFind = (list: SlimBranch[], slug: string) => {
    const b = list.find(x => x.branchSlug === slug);
    if (!b) throw new Error(`Branch not found: ${slug}`);
    return b;
  };
  
  // after you create users (uOwner, uAdmin, uEditor, uViewer, uMixed) in seedTestUsers():
  // Example (put at the end of seedTestUsers):
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
