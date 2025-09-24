// apps/server/prisma/seed.ts
// import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Simple hashing just for seed/demo
  const hash = (pwd: string) => bcrypt.hash(pwd, 8);

  // Upsert tenants
  const blue = await prisma.tenant.upsert({
    where: { slug: "blue" },
    update: {},
    create: { slug: "blue", name: "Blue Corp" },
  });

  const green = await prisma.tenant.upsert({
    where: { slug: "green" },
    update: {},
    create: { slug: "green", name: "Green Inc." },
  });

  // Users
  const alice = await prisma.user.upsert({
    where: { email: "alice@blue.test" },
    update: {},
    create: {
      email: "alice@blue.test",
      passwordHash: await hash("password123"),
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@green.test" },
    update: {},
    create: {
      email: "bob@green.test",
      passwordHash: await hash("password123"),
    },
  });

  // Memberships
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: alice.id, tenantId: blue.id } },
    update: {},
    create: { userId: alice.id, tenantId: blue.id, role: UserRole.OWNER },
  });

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: bob.id, tenantId: green.id } },
    update: {},
    create: { userId: bob.id, tenantId: green.id, role: UserRole.OWNER },
  });

  // Posts per tenant
  await prisma.post.create({
    data: {
      tenantId: blue.id,
      authorId: alice.id,
      title: "Blue's first post",
      content: "Hello from Blue!",
      status: "PUBLISHED",
    },
  });

  await prisma.post.create({
    data: {
      tenantId: green.id,
      authorId: bob.id,
      title: "Green's first post",
      content: "Hello from Green!",
      status: "PUBLISHED",
    },
  });

  console.log("Seeded tenants/users/posts ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
