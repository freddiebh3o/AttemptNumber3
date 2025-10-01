/// <reference types="node" />

import { PrismaClient } from '@prisma/client'
import { provisionTenantRBAC } from '../src/services/roleProvisioningService'

const prismaClientInstance = new PrismaClient()

async function upsertManyProductsForTenant(opts: {
  tenantId: string
  tenantPrefix: 'ACME' | 'GLOBEX'
  startIndex: number
  count: number
}) {
  const { tenantId, tenantPrefix, startIndex, count } = opts

  const pad3 = (n: number) => String(n).padStart(3, '0')

  const batchSize = 50
  let created = 0

  for (let offset = 0; offset < count; offset += batchSize) {
    const batchEnd = Math.min(offset + batchSize, count)
    const tasks: Array<Promise<any>> = []

    for (let i = offset; i < batchEnd; i++) {
      const n = startIndex + i
      const productSku = `${tenantPrefix}-SKU-${pad3(n)}`
      const productName = `${tenantPrefix} Product ${n}`
      const productPriceCents = 199 + ((n * 137) % 97501)

      tasks.push(
        prismaClientInstance.product
          .upsert({
            where: { tenantId_productSku: { tenantId, productSku } },
            update: { productName, productPriceCents },
            create: { tenantId, productName, productSku, productPriceCents },
            select: { id: true },
          })
          .then(() => { created += 1 })
          .catch((e) => {
            throw new Error(
              `Upsert failed for ${tenantPrefix} n=${n} (${productSku}): ${String(e?.message ?? e)}`
            )
          })
      )
    }

    await Promise.all(tasks)
  }

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
    create: { tenantSlug: 'acme', tenantName: 'Acme Incorporated' },
  })
  await provisionTenantRBAC(acmeTenant.id, prismaClientInstance)

  const globexTenant = await prismaClientInstance.tenant.upsert({
    where: { tenantSlug: 'globex' },
    update: {},
    create: { tenantSlug: 'globex', tenantName: 'Globex Corporation' },
  })
  await provisionTenantRBAC(globexTenant.id, prismaClientInstance)

  // ----- Hand-authored products -----
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeTenant.id, productSku: 'ACME-SKU-001' } },
    update: { productName: 'Acme Anvil', productPriceCents: 1999 },
    create: { tenantId: acmeTenant.id, productName: 'Acme Anvil', productSku: 'ACME-SKU-001', productPriceCents: 1999 },
  })
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: acmeTenant.id, productSku: 'ACME-SKU-002' } },
    update: { productName: 'Acme Rocket Skates', productPriceCents: 4999 },
    create: { tenantId: acmeTenant.id, productName: 'Acme Rocket Skates', productSku: 'ACME-SKU-002', productPriceCents: 4999 },
  })

  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: globexTenant.id, productSku: 'GLOBEX-SKU-001' } },
    update: { productName: 'Globex Heat Lamp', productPriceCents: 2999 },
    create: { tenantId: globexTenant.id, productName: 'Globex Heat Lamp', productSku: 'GLOBEX-SKU-001', productPriceCents: 2999 },
  })
  await prismaClientInstance.product.upsert({
    where: { tenantId_productSku: { tenantId: globexTenant.id, productSku: 'GLOBEX-SKU-002' } },
    update: { productName: 'Globex Shrink Ray', productPriceCents: 9999 },
    create: { tenantId: globexTenant.id, productName: 'Globex Shrink Ray', productSku: 'GLOBEX-SKU-002', productPriceCents: 9999 },
  })

  // ----- Bulk products for pagination testing -----
  await upsertManyProductsForTenant({ tenantId: acmeTenant.id, tenantPrefix: 'ACME', startIndex: 100, count: 150 })
  await upsertManyProductsForTenant({ tenantId: globexTenant.id, tenantPrefix: 'GLOBEX', startIndex: 100, count: 120 })

  console.log('Seed complete. Tenants:', ['acme', 'globex'])
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClientInstance.$disconnect()
  })
