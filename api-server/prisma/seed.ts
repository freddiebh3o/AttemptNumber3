/// <reference types="node" />

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prismaClientInstance = new PrismaClient()

async function upsertManyProductsForTenant(opts: {
  tenantId: string
  tenantPrefix: 'ACME' | 'GLOBEX'
  startIndex: number
  count: number
}) {
  const { tenantId, tenantPrefix, startIndex, count } = opts

  // Helper to zero-pad index to 3 digits (e.g., 007, 120)
  const pad3 = (n: number) => String(n).padStart(3, '0')

  // Seed in modest batches to avoid hammering the DB connection
  const batchSize = 50
  let created = 0
  let updated = 0

  for (let offset = 0; offset < count; offset += batchSize) {
    const batchEnd = Math.min(offset + batchSize, count)
    const tasks: Array<Promise<any>> = []

    for (let i = offset; i < batchEnd; i++) {
      const n = startIndex + i
      const productSku = `${tenantPrefix}-SKU-${pad3(n)}`
      const productName = `${tenantPrefix} Product ${n}`

      // Spread prices across a range with some variety, always >= 199
      const productPriceCents =
        199 + ((n * 137) % 97501) // deterministic but varied; max ~ 97700

      tasks.push(
        prismaClientInstance.product
          .upsert({
            where: {
              tenantId_productSku: { tenantId, productSku },
            },
            update: {
              productName,
              productPriceCents,
            },
            create: {
              tenantId,
              productName,
              productSku,
              productPriceCents,
            },
            select: { id: true }, // keep the payload small
          })
          .then((_) => {
            // upsert doesn't tell us create vs update directly; do a cheap check:
            // We can optimistically count all as "created/updated" evenly is unnecessary.
            // For simplicity we track total upserts; real split isn't critical here.
            created += 1
          })
          .catch((e) => {
            // If you prefer strict failure, rethrow. Here we surface the error clearly.
            throw new Error(
              `Upsert failed for ${tenantPrefix} n=${n} (${productSku}): ${String(
                e?.message ?? e
              )}`
            )
          })
      )
    }

    await Promise.all(tasks)
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${tenantPrefix}: upserted ${created} products (range ${tenantPrefix}-SKU-${pad3(
      startIndex
    )}..${tenantPrefix}-SKU-${pad3(startIndex + count - 1)})`
  )
}

async function main() {
  // ----- Tenants -----
  const acmeTenant = await prismaClientInstance.tenant.upsert({
    where: { tenantSlug: 'acme' },
    update: {},
    create: {
      tenantSlug: 'acme',
      tenantName: 'Acme Incorporated',
    },
  })

  const globexTenant = await prismaClientInstance.tenant.upsert({
    where: { tenantSlug: 'globex' },
    update: {},
    create: {
      tenantSlug: 'globex',
      tenantName: 'Globex Corporation',
    },
  })

  // ----- Users -----
  const plainTextPasswordForDemoUser = 'Password123!' // demo only
  const hashedPasswordForDemoUser = await bcrypt.hash(plainTextPasswordForDemoUser, 10)

  const demoUser = await prismaClientInstance.user.upsert({
    where: { userEmailAddress: 'admin@example.com' },
    update: {},
    create: {
      userEmailAddress: 'admin@example.com',
      userHashedPassword: hashedPasswordForDemoUser,
    },
  })

  // ----- Memberships (same user in two tenants) -----
  await prismaClientInstance.userTenantMembership.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: acmeTenant.id } },
    update: { roleName: 'ADMIN' },
    create: {
      userId: demoUser.id,
      tenantId: acmeTenant.id,
      roleName: 'ADMIN',
    },
  })

  await prismaClientInstance.userTenantMembership.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: globexTenant.id } },
    update: { roleName: 'EDITOR' },
    create: {
      userId: demoUser.id,
      tenantId: globexTenant.id,
      roleName: 'EDITOR',
    },
  })

  // ----- A couple of hand-authored products (kept from your original) -----
  // ACME baseline
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeTenant.id, productSku: 'ACME-SKU-001' } },
    update: { productName: 'Acme Anvil', productPriceCents: 1999 },
    create: {
      tenantId: acmeTenant.id,
      productName: 'Acme Anvil',
      productSku: 'ACME-SKU-001',
      productPriceCents: 1999,
    },
  })
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeTenant.id, productSku: 'ACME-SKU-002' } },
    update: { productName: 'Acme Rocket Skates', productPriceCents: 4999 },
    create: {
      tenantId: acmeTenant.id,
      productName: 'Acme Rocket Skates',
      productSku: 'ACME-SKU-002',
      productPriceCents: 4999,
    },
  })

  // GLOBEX baseline
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: globexTenant.id, productSku: 'GLOBEX-SKU-001' } },
    update: { productName: 'Globex Heat Lamp', productPriceCents: 2999 },
    create: {
      tenantId: globexTenant.id,
      productName: 'Globex Heat Lamp',
      productSku: 'GLOBEX-SKU-001',
      productPriceCents: 2999,
    },
  })
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: globexTenant.id, productSku: 'GLOBEX-SKU-002' } },
    update: { productName: 'Globex Shrink Ray', productPriceCents: 9999 },
    create: {
      tenantId: globexTenant.id,
      productName: 'Globex Shrink Ray',
      productSku: 'GLOBEX-SKU-002',
      productPriceCents: 9999,
    },
  })

  // ----- Bulk products for pagination testing -----
  // These ranges avoid clashing with the 001/002 SKUs you already upserted.
  await upsertManyProductsForTenant({
    tenantId: acmeTenant.id,
    tenantPrefix: 'ACME',
    startIndex: 100,
    count: 150, // ~3 pages @ limit=50
  })

  await upsertManyProductsForTenant({
    tenantId: globexTenant.id,
    tenantPrefix: 'GLOBEX',
    startIndex: 100,
    count: 120, // ~3 pages @ limit=50
  })

  // Log the demo credentials for your local testing (do not do this in prod)
  // eslint-disable-next-line no-console
  console.log('Seed complete.')
  console.log('Demo user email:', 'admin@example.com')
  console.log('Demo user password:', plainTextPasswordForDemoUser)
  console.log('Tenants:', ['acme', 'globex'])
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClientInstance.$disconnect()
  })
