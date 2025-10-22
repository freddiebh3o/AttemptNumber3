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

  // Get OpenAI API key from environment for ACME tenant
  const openaiApiKey = process.env.OPENAI_API_KEY || null;

  const acme = await prisma.tenant.upsert({
    where: { tenantSlug: 'acme' },
    update: {
      featureFlags: {
        barcodeScanningEnabled: true,  // Enable for testing
        barcodeScanningMode: 'camera',
        chatAssistantEnabled: true,    // Enable chat assistant for testing
        openaiApiKey: openaiApiKey,    // Use server's API key if available
      },
    },
    create: {
      tenantSlug: 'acme',
      tenantName: 'Acme Incorporated',
      featureFlags: {
        barcodeScanningEnabled: true,  // Enable for testing
        barcodeScanningMode: 'camera',
        chatAssistantEnabled: true,    // Enable chat assistant for testing
        openaiApiKey: openaiApiKey,    // Use server's API key if available
      },
    },
  });
  await provisionTenantRBAC(acme.id, prisma); // ensures/aligns system roles

  const globex = await prisma.tenant.upsert({
    where: { tenantSlug: 'globex' },
    update: {
      featureFlags: {
        barcodeScanningEnabled: false, // Disabled by default
        barcodeScanningMode: null,
        chatAssistantEnabled: false,   // Disabled by default
        openaiApiKey: null,
      },
    },
    create: {
      tenantSlug: 'globex',
      tenantName: 'Globex Corporation',
      featureFlags: {
        barcodeScanningEnabled: false, // Disabled by default
        barcodeScanningMode: null,
        chatAssistantEnabled: false,   // Disabled by default
        openaiApiKey: null,
      },
    },
  });
  await provisionTenantRBAC(globex.id, prisma);

  console.log('--- Feature flags seeded ---');
  console.log('ACME: barcodeScanningEnabled=true (camera mode), chatAssistantEnabled=true');
  console.log('Globex: barcodeScanningEnabled=false, chatAssistantEnabled=false');
  if (openaiApiKey) {
    console.log('ACME OpenAI API key configured from environment');
  } else {
    console.log('⚠️  OPENAI_API_KEY not set in environment - chat tests may fail');
  }

  return { acmeId: acme.id, globexId: globex.id };
}

async function seedProducts(acmeId: string, globexId: string) {
  // Hand-authored examples (prices in **pence**)
  // With barcodes for barcode scanning feature testing
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeId, productSku: 'ACME-SKU-001' } },
    update: { productName: 'Acme Anvil', productPricePence: 1999, barcode: '5012345678900', barcodeType: 'EAN13' },
    create: {
      tenantId: acmeId,
      productName: 'Acme Anvil',
      productSku: 'ACME-SKU-001',
      productPricePence: 1999,
      barcode: '5012345678900', // EAN-13 format
      barcodeType: 'EAN13'
    },
  });
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeId, productSku: 'ACME-SKU-002' } },
    update: { productName: 'Acme Rocket Skates', productPricePence: 4999, barcode: '012345678905', barcodeType: 'UPCA' },
    create: {
      tenantId: acmeId,
      productName: 'Acme Rocket Skates',
      productSku: 'ACME-SKU-002',
      productPricePence: 4999,
      barcode: '012345678905', // UPC-A format
      barcodeType: 'UPCA'
    },
  });

  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: globexId, productSku: 'GLOBEX-SKU-001' } },
    update: { productName: 'Globex Heat Lamp', productPricePence: 2999, barcode: 'GLX-HEAT-001', barcodeType: 'CODE128' },
    create: {
      tenantId: globexId,
      productName: 'Globex Heat Lamp',
      productSku: 'GLOBEX-SKU-001',
      productPricePence: 2999,
      barcode: 'GLX-HEAT-001', // Code 128 format (alphanumeric)
      barcodeType: 'CODE128'
    },
  });
  await prisma.product.upsert({
    where: { tenantId_productSku: { tenantId: globexId, productSku: 'GLOBEX-SKU-002' } },
    update: { productName: 'Globex Shrink Ray', productPricePence: 9999 },
    create: {
      tenantId: globexId,
      productName: 'Globex Shrink Ray',
      productSku: 'GLOBEX-SKU-002',
      productPricePence: 9999
      // No barcode - demonstrates optional barcode field
    },
  });

  // Bulk for pagination testing (no barcodes)
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

  // Use dynamic dates (last 10 days)
  const now = new Date();
  const daysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  // Create a COMPLETED transfer (NORMAL priority)
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
      priority: 'NORMAL',
      requestedByUserId: users.viewer.id, // viewer at retail-1
      reviewedByUserId: users.admin.id, // admin at warehouse
      shippedByUserId: users.admin.id,
      requestedAt: daysAgo(8),
      reviewedAt: new Date(daysAgo(8).getTime() + 1.5 * 3600000),
      shippedAt: new Date(daysAgo(8).getTime() + 5 * 3600000),
      completedAt: new Date(daysAgo(7).getTime()),
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

  // Create an IN_TRANSIT transfer (HIGH priority)
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
      priority: 'HIGH',
      requestedByUserId: users.viewer.id,
      reviewedByUserId: users.admin.id,
      shippedByUserId: users.admin.id,
      requestedAt: daysAgo(3),
      reviewedAt: new Date(daysAgo(3).getTime() + 2 * 3600000),
      shippedAt: new Date(daysAgo(3).getTime() + 6 * 3600000),
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

  // Create a REQUESTED transfer (URGENT priority)
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
      priority: 'URGENT',
      requestedByUserId: users.viewer.id,
      requestedAt: daysAgo(1),
      requestNotes: 'URGENT: Stock-out situation at retail store',
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

  // Create a COMPLETED transfer (LOW priority)
  await prisma.stockTransfer.upsert({
    where: {
      tenantId_transferNumber: {
        tenantId: acmeId,
        transferNumber: 'TRF-2025-004',
      },
    },
    update: {},
    create: {
      tenantId: acmeId,
      transferNumber: 'TRF-2025-004',
      sourceBranchId: acmeWarehouse.id,
      destinationBranchId: acmeRetail1.id,
      status: 'COMPLETED',
      priority: 'LOW',
      requestedByUserId: users.editor.id,
      reviewedByUserId: users.admin.id,
      shippedByUserId: users.admin.id,
      requestedAt: daysAgo(5),
      reviewedAt: new Date(daysAgo(5).getTime() + 5 * 3600000),
      shippedAt: new Date(daysAgo(4).getTime() + 1 * 3600000),
      completedAt: new Date(daysAgo(3).getTime() + 2 * 3600000),
      requestNotes: 'Seasonal overstock redistribution',
      items: {
        create: [
          {
            productId: product2.id,
            qtyRequested: 25,
            qtyApproved: 25,
            qtyShipped: 25,
            qtyReceived: 25,
            avgUnitCostPence: 3500,
          },
        ],
      },
    },
  });

  console.log('--- Stock transfers seeded ---');
  console.log('TRF-2025-001: COMPLETED (NORMAL priority) - Warehouse → Retail #1');
  console.log('TRF-2025-002: IN_TRANSIT (HIGH priority) - Warehouse → Retail #1');
  console.log('TRF-2025-003: REQUESTED (URGENT priority) - Warehouse → Retail #1');
  console.log('TRF-2025-004: COMPLETED (LOW priority) - Warehouse → Retail #1');
}

async function seedHistoricalTransfers(
  acmeId: string,
  users: SeededUsers,
  acmeBranches: SlimBranch[]
) {
  const mustFind = (list: SlimBranch[], slug: string) => {
    const b = list.find(x => x.branchSlug === slug);
    if (!b) throw new Error(`Branch not found: ${slug}`);
    return b;
  };

  const acmeWarehouse = mustFind(acmeBranches, 'acme-warehouse');
  const acmeRetail1 = mustFind(acmeBranches, 'acme-retail-1');
  const acmeHQ = mustFind(acmeBranches, 'acme-hq');

  // Get ALL products (not just first 2)
  const products = await prisma.product.findMany({
    where: { tenantId: acmeId },
    select: { id: true, productSku: true, productPricePence: true },
    take: 20, // Use up to 20 products for variety
  });

  if (products.length < 2) {
    console.log('Skipping historical transfers: not enough products');
    return;
  }

  // Define routes with varying traffic patterns
  const routes = [
    { from: acmeWarehouse, to: acmeRetail1, frequency: 0.6 }, // High traffic (main route)
    { from: acmeWarehouse, to: acmeHQ, frequency: 0.3 }, // Medium traffic
    { from: acmeHQ, to: acmeRetail1, frequency: 0.1 }, // Low traffic (redistribution)
  ];

  const priorities: Array<{ priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; weight: number }> = [
    { priority: 'NORMAL', weight: 0.6 }, // 60% normal
    { priority: 'HIGH', weight: 0.25 },   // 25% high
    { priority: 'LOW', weight: 0.1 },     // 10% low
    { priority: 'URGENT', weight: 0.05 }, // 5% urgent
  ];

  const statuses: Array<{ status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'; weight: number }> = [
    { status: 'COMPLETED', weight: 0.65 }, // 65% completed
    { status: 'IN_TRANSIT', weight: 0.15 }, // 15% in transit
    { status: 'APPROVED', weight: 0.1 },    // 10% approved
    { status: 'REQUESTED', weight: 0.08 },  // 8% requested
    { status: 'REJECTED', weight: 0.02 },   // 2% rejected
  ];

  let transferCount = 0;
  const today = new Date(); // Use actual current date

  // Generate 60 days of historical transfers (going backwards for better trend visualization)
  for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);

    // Weekday vs weekend pattern (more transfers on weekdays)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseTransfersPerDay = isWeekend ? 2 : 6;

    // Add some randomness and weekly seasonality
    const weekNumber = Math.floor(dayOffset / 7);
    const seasonalMultiplier = 1 + (Math.sin(weekNumber * 0.5) * 0.3); // ±30% variation
    const transfersPerDay = Math.max(1, Math.floor(baseTransfersPerDay * seasonalMultiplier + (Math.random() * 2 - 1)));

    for (let i = 0; i < transfersPerDay; i++) {
      // Select route based on weighted frequency
      const routeRand = Math.random();
      let cumulativeFreq = 0;
      let selectedRoute = routes[0];
      for (const route of routes) {
        cumulativeFreq += route.frequency;
        if (routeRand <= cumulativeFreq) {
          selectedRoute = route;
          break;
        }
      }

      // Weighted priority selection
      const priorityRand = Math.random();
      let priorityCumulative = 0;
      let selectedPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
      for (const p of priorities) {
        priorityCumulative += p.weight;
        if (priorityRand <= priorityCumulative) {
          selectedPriority = p.priority;
          break;
        }
      }

      // Weighted status selection
      const statusRand = Math.random();
      let statusCumulative = 0;
      let selectedStatus: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' = 'COMPLETED';
      for (const s of statuses) {
        statusCumulative += s.weight;
        if (statusRand <= statusCumulative) {
          selectedStatus = s.status;
          break;
        }
      }

      const transferNumber = `TRF-2025-${String(5000 + transferCount).padStart(4, '0')}`;

      // Calculate realistic timestamps based on status
      const requestedAt = new Date(date);
      requestedAt.setHours(9 + Math.floor(Math.random() * 7)); // 9am-4pm
      requestedAt.setMinutes(Math.floor(Math.random() * 60));

      const reviewedAt = selectedStatus !== 'REQUESTED' && selectedStatus !== 'CANCELLED'
        ? new Date(requestedAt.getTime() + (0.5 + Math.random() * 4) * 3600000) // 30min-4.5 hours later
        : null;

      const shippedAt = ['IN_TRANSIT', 'COMPLETED'].includes(selectedStatus) && reviewedAt
        ? new Date(reviewedAt.getTime() + (1 + Math.random() * 8) * 3600000) // 1-9 hours later
        : null;

      const completedAt = selectedStatus === 'COMPLETED' && shippedAt
        ? new Date(shippedAt.getTime() + (6 + Math.random() * 30) * 3600000) // 6-36 hours later
        : null;

      // Multi-item transfers (20% chance of multiple products)
      const numItems = Math.random() > 0.8 ? 2 : 1;
      const selectedProducts: Array<{ id: string; productSku: string; productPricePence: number }> = [];
      for (let j = 0; j < numItems; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        if (!selectedProducts.find(p => p.id === product.id)) {
          selectedProducts.push(product);
        }
      }

      const items = selectedProducts.map(product => {
        const qtyRequested = Math.floor(Math.random() * 120) + 10; // 10-130 units
        const qtyApproved = selectedStatus !== 'REQUESTED' && selectedStatus !== 'REJECTED' && selectedStatus !== 'CANCELLED'
          ? qtyRequested
          : null;
        const qtyShipped = ['IN_TRANSIT', 'COMPLETED'].includes(selectedStatus) && qtyApproved
          ? qtyApproved
          : 0;
        const qtyReceived = selectedStatus === 'COMPLETED' ? qtyShipped : 0;

        return {
          productId: product.id,
          qtyRequested,
          qtyApproved,
          qtyShipped,
          qtyReceived,
          avgUnitCostPence: qtyShipped > 0 ? Math.floor(product.productPricePence * 0.6) : null, // Cost ~60% of price
        };
      });

      try {
        await prisma.stockTransfer.create({
          data: {
            tenantId: acmeId,
            transferNumber,
            sourceBranchId: selectedRoute.from.id,
            destinationBranchId: selectedRoute.to.id,
            status: selectedStatus,
            priority: selectedPriority,
            requestedByUserId: users.editor.id,
            reviewedByUserId: reviewedAt ? users.admin.id : null,
            shippedByUserId: shippedAt ? users.admin.id : null,
            requestedAt,
            reviewedAt,
            shippedAt,
            completedAt,
            requestNotes: `${selectedPriority} priority transfer - ${selectedRoute.from.branchSlug} to ${selectedRoute.to.branchSlug}`,
            reviewNotes: selectedStatus === 'REJECTED' ? 'Insufficient stock available' : null,
            items: {
              create: items,
            },
          },
        });

        transferCount++;
      } catch (error: any) {
        // Skip if transfer number already exists (from previous seed runs)
        if (!error.message?.includes('Unique constraint')) {
          console.error(`Failed to create transfer ${transferNumber}:`, error.message);
        }
      }
    }
  }

  console.log('--- Historical transfers seeded ---');
  console.log(`Created ${transferCount} historical transfers over 60 days`);
  console.log(`Routes: Warehouse→Retail #1 (60%), Warehouse→HQ (30%), HQ→Retail #1 (10%)`);
  console.log(`Status distribution: COMPLETED (65%), IN_TRANSIT (15%), APPROVED (10%), REQUESTED (8%), REJECTED (2%)`);
  console.log(`Priority distribution: NORMAL (60%), HIGH (25%), LOW (10%), URGENT (5%)`);
  console.log(`Volume pattern: Weekdays (6 avg), Weekends (2 avg), with seasonal variation`);
}

async function seedTransferTemplates(
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

  // Get products for templates
  const products = await prisma.product.findMany({
    where: {
      tenantId: acmeId,
      productSku: { in: ['ACME-SKU-001', 'ACME-SKU-002'] },
    },
    select: { id: true, productSku: true },
  });

  if (products.length < 2) {
    console.log('Skipping transfer template seed: not enough products');
    return;
  }

  const product1 = products.find(p => p.productSku === 'ACME-SKU-001')!;
  const product2 = products.find(p => p.productSku === 'ACME-SKU-002')!;

  // Template 1: Weekly Retail Restock
  const template1 = await prisma.stockTransferTemplate.upsert({
    where: {
      id: 'acme-template-1', // Use fixed ID for upsert
    },
    update: {},
    create: {
      id: 'acme-template-1',
      tenantId: acmeId,
      name: 'Weekly Retail Restock',
      description: 'Standard weekly transfer from warehouse to retail store #1',
      sourceBranchId: acmeWarehouse.id,
      destinationBranchId: acmeRetail1.id,
      createdByUserId: users.admin.id,
      items: {
        create: [
          {
            productId: product1.id,
            defaultQty: 50,
          },
          {
            productId: product2.id,
            defaultQty: 30,
          },
        ],
      },
    },
  });

  // Template 2: Emergency Restock
  const template2 = await prisma.stockTransferTemplate.upsert({
    where: {
      id: 'acme-template-2',
    },
    update: {},
    create: {
      id: 'acme-template-2',
      tenantId: acmeId,
      name: 'Emergency Restock',
      description: 'Urgent transfer for stock-out situations',
      sourceBranchId: acmeWarehouse.id,
      destinationBranchId: acmeRetail1.id,
      createdByUserId: users.admin.id,
      items: {
        create: [
          {
            productId: product1.id,
            defaultQty: 100,
          },
        ],
      },
    },
  });

  console.log('--- Transfer templates seeded ---');
  console.log('Template 1: Weekly Retail Restock (2 products)');
  console.log('Template 2: Emergency Restock (1 product)');
}

async function seedApprovalRules(
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

  // Get ADMIN and OWNER role IDs
  const adminRoleId = await getRoleId(acmeId, 'ADMIN');
  const ownerRoleId = await getRoleId(acmeId, 'OWNER');

  // Rule 1: High Quantity Approval (>100 units requires 2-level approval)
  await prisma.transferApprovalRule.upsert({
    where: {
      id: 'acme-rule-high-qty',
    },
    update: {},
    create: {
      id: 'acme-rule-high-qty',
      tenantId: acmeId,
      name: 'High Quantity Transfer Approval',
      description: 'Transfers with more than 100 total units require manager and director approval',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 10,
      conditions: {
        create: [
          {
            conditionType: 'TOTAL_QTY_THRESHOLD',
            threshold: 100,
          },
        ],
      },
      levels: {
        create: [
          {
            level: 1,
            name: 'Manager Approval',
            requiredRoleId: adminRoleId,
          },
          {
            level: 2,
            name: 'Director Approval',
            requiredRoleId: ownerRoleId,
          },
        ],
      },
    },
  });

  // Rule 2: High Value Approval (>£100 requires owner approval)
  await prisma.transferApprovalRule.upsert({
    where: {
      id: 'acme-rule-high-value',
    },
    update: {},
    create: {
      id: 'acme-rule-high-value',
      tenantId: acmeId,
      name: 'High Value Transfer Approval',
      description: 'Transfers valued over £100 require owner approval',
      isActive: true,
      approvalMode: 'SEQUENTIAL',
      priority: 20,
      conditions: {
        create: [
          {
            conditionType: 'TOTAL_VALUE_THRESHOLD',
            threshold: 10000, // £100 in pence
          },
        ],
      },
      levels: {
        create: [
          {
            level: 1,
            name: 'Owner Approval',
            requiredRoleId: ownerRoleId,
          },
        ],
      },
    },
  });

  // Rule 3: Warehouse Outbound Approval (transfers FROM warehouse require manager approval)
  await prisma.transferApprovalRule.upsert({
    where: {
      id: 'acme-rule-warehouse-outbound',
    },
    update: {},
    create: {
      id: 'acme-rule-warehouse-outbound',
      tenantId: acmeId,
      name: 'Warehouse Outbound Approval',
      description: 'All transfers from the warehouse require manager approval',
      isActive: false, // Disabled by default (demo rule)
      approvalMode: 'PARALLEL',
      priority: 5,
      conditions: {
        create: [
          {
            conditionType: 'SOURCE_BRANCH',
            branchId: acmeWarehouse.id,
          },
        ],
      },
      levels: {
        create: [
          {
            level: 1,
            name: 'Warehouse Manager',
            requiredRoleId: adminRoleId,
          },
        ],
      },
    },
  });

  console.log('--- Approval rules seeded ---');
  console.log('Rule 1: High Quantity (>100 units) - ACTIVE, 2-level sequential');
  console.log('Rule 2: High Value (>£100) - ACTIVE, 1-level');
  console.log('Rule 3: Warehouse Outbound - INACTIVE (demo rule)');
}

async function seedAnalyticsMetrics(
  acmeId: string,
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
  const acmeHQ = mustFind(acmeBranches, 'acme-hq');

  // Seed TransferMetrics for the last 7 days
  const today = new Date(); // Use actual current date
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    await prisma.transferMetrics.upsert({
      where: {
        tenantId_metricDate: {
          tenantId: acmeId,
          metricDate: date,
        },
      },
      update: {},
      create: {
        tenantId: acmeId,
        metricDate: date,
        transfersCreated: Math.floor(Math.random() * 5) + 1, // 1-5 transfers
        transfersApproved: Math.floor(Math.random() * 4) + 1, // 1-4 transfers
        transfersShipped: Math.floor(Math.random() * 3) + 1, // 1-3 transfers
        transfersCompleted: Math.floor(Math.random() * 3), // 0-2 transfers
        transfersRejected: Math.random() > 0.8 ? 1 : 0, // 20% chance of rejection
        transfersCancelled: 0,
        // Average times in seconds
        avgApprovalTime: 5400 + Math.floor(Math.random() * 3600), // ~1.5-2.5 hours
        avgShipTime: 14400 + Math.floor(Math.random() * 7200), // ~4-6 hours
        avgReceiveTime: 43200 + Math.floor(Math.random() * 21600), // ~12-18 hours
        avgTotalTime: 86400 + Math.floor(Math.random() * 43200), // ~24-36 hours
      },
    });
  }

  // Seed TransferRouteMetrics for common routes
  const routes = [
    { source: acmeWarehouse, dest: acmeRetail1, transferCount: 15, totalUnits: 450 },
    { source: acmeWarehouse, dest: acmeHQ, transferCount: 8, totalUnits: 200 },
    { source: acmeHQ, dest: acmeRetail1, transferCount: 5, totalUnits: 120 },
  ];

  for (const route of routes) {
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Only seed metrics for some days (simulate varying activity)
      if (Math.random() > 0.3) {
        await prisma.transferRouteMetrics.upsert({
          where: {
            tenantId_sourceBranchId_destinationBranchId_metricDate: {
              tenantId: acmeId,
              sourceBranchId: route.source.id,
              destinationBranchId: route.dest.id,
              metricDate: date,
            },
          },
          update: {},
          create: {
            tenantId: acmeId,
            sourceBranchId: route.source.id,
            destinationBranchId: route.dest.id,
            metricDate: date,
            transferCount: Math.floor(Math.random() * 3) + 1, // 1-3 transfers
            totalUnits: Math.floor(Math.random() * 100) + 20, // 20-120 units
            avgCompletionTime: 72000 + Math.floor(Math.random() * 36000), // ~20-30 hours
          },
        });
      }
    }
  }

  console.log('--- Analytics metrics seeded ---');
  console.log('TransferMetrics: 7 days of data');
  console.log('TransferRouteMetrics: 3 routes × ~5 days each');
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
  await addUserToBranches(users.editor.id, acmeId, [acmeHQ.id, acmeWarehouse.id, acmeRetail1.id]);
  await addUserToBranches(users.viewer.id, acmeId, [acmeRetail1.id]);
  await addUserToBranches(users.mixed.id, acmeId,   [acmeHQ.id]);
  await addUserToBranches(users.mixed.id, globexId, [globexHQ.id]);   // and globex

  // Stock transfers
  await seedStockTransfers(acmeId, users, acmeBranches);

  // Historical transfers for analytics
  await seedHistoricalTransfers(acmeId, users, acmeBranches);

  // Transfer templates
  await seedTransferTemplates(acmeId, users, acmeBranches);

  // Approval rules
  await seedApprovalRules(acmeId, users, acmeBranches);

  // Analytics metrics
  await seedAnalyticsMetrics(acmeId, acmeBranches);

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
