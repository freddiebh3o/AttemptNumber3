
/// <reference types="node" />

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prismaClientInstance = new PrismaClient()

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
    update: { roleName: "ADMIN" },
    create: {
      userId: demoUser.id,
      tenantId: acmeTenant.id,
      roleName: "ADMIN",
    },
  })

  await prismaClientInstance.userTenantMembership.upsert({
    where: { userId_tenantId: { userId: demoUser.id, tenantId: globexTenant.id } },
    update: { roleName: "EDITOR" },
    create: {
      userId: demoUser.id,
      tenantId: globexTenant.id,
      roleName: "EDITOR",
    },
  })

  // ----- Products per tenant -----
  // ACME
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

  // GLOBEX
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
