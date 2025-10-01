/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Password123!';

async function getTenantIdBySlug(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { tenantSlug: slug }, select: { id: true } });
  if (!t) throw new Error(`Tenant not found: ${slug}`);
  return t.id;
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
    update: { roleId, roleName: null }, // ensure new model path
    create: { userId, tenantId, roleId, roleName: null },
  });
}

async function main() {
  const [acmeId, globexId] = await Promise.all([
    getTenantIdBySlug('acme'),
    getTenantIdBySlug('globex'),
  ]);

  const [ownerRoleId, adminRoleId, editorRoleId, viewerRoleId] = await Promise.all([
    getRoleId(acmeId, 'OWNER'),
    getRoleId(acmeId, 'ADMIN'),
    getRoleId(acmeId, 'EDITOR'),
    getRoleId(acmeId, 'VIEWER'),
  ]);
  const [globexViewerRoleId, globexEditorRoleId] = await Promise.all([
    getRoleId(globexId, 'VIEWER'),
    getRoleId(globexId, 'EDITOR'),
  ]);

  const hashed = await bcrypt.hash(PASSWORD, 10);

  // Create users
  const [uOwner, uAdmin, uEditor, uViewer, uMixed] = await Promise.all([
    upsertUser('owner@acme.test', hashed),
    upsertUser('admin@acme.test', hashed),
    upsertUser('editor@acme.test', hashed),
    upsertUser('viewer@acme.test', hashed),
    upsertUser('mixed@both.test', hashed),
  ]);

  // Assign memberships
  await Promise.all([
    // ACME single-role users
    upsertMembershipWithRole(uOwner.id,  acmeId, ownerRoleId),
    upsertMembershipWithRole(uAdmin.id,  acmeId, adminRoleId),
    upsertMembershipWithRole(uEditor.id, acmeId, editorRoleId),
    upsertMembershipWithRole(uViewer.id, acmeId, viewerRoleId),

    // Mixed user across tenants
    upsertMembershipWithRole(uMixed.id, acmeId,   editorRoleId),
    upsertMembershipWithRole(uMixed.id, globexId, globexViewerRoleId),
  ]);

  // Also ensure Globex editor role is referenced at least once (example)
  await upsertMembershipWithRole(uEditor.id, globexId, globexEditorRoleId);

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
