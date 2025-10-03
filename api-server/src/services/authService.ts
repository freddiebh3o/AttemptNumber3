// api-server/src/services/authService.ts
import bcrypt from 'bcryptjs';
import { prismaClientInstance } from '../db/prismaClient.js';

export async function verifyUserCredentialsForTenantService(params: {
  userEmailAddressInputValue: string;
  userPlainTextPasswordInputValue: string;
  tenantSlugInputValue: string;
}): Promise<{ matchedUserId: string; matchedTenantId: string } | null> {
  const { userEmailAddressInputValue, userPlainTextPasswordInputValue, tenantSlugInputValue } = params;

  const matchedUserRecord = await prismaClientInstance.user.findUnique({
    where: { userEmailAddress: userEmailAddressInputValue },
    select: { id: true, userHashedPassword: true },
  });
  if (!matchedUserRecord) return null;

  const isPasswordValid = await bcrypt.compare(
    userPlainTextPasswordInputValue,
    matchedUserRecord.userHashedPassword
  );
  if (!isPasswordValid) return null;

  const matchedTenantRecord = await prismaClientInstance.tenant.findUnique({
    where: { tenantSlug: tenantSlugInputValue },
    select: { id: true },
  });
  if (!matchedTenantRecord) return null;

  const membership = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: matchedUserRecord.id, tenantId: matchedTenantRecord.id } },
    select: { userId: true, tenantId: true },
  });
  if (!membership) return null;

  return { matchedUserId: membership.userId, matchedTenantId: membership.tenantId };
}

export async function getUserMembershipsService(params: { currentUserId: string }) {
  const { currentUserId } = params;

  const memberships = await prismaClientInstance.userTenantMembership.findMany({
    where: { userId: currentUserId },
    select: {
      tenant: { select: { tenantSlug: true, tenantName: true, id: true } },
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
    orderBy: [{ tenant: { tenantSlug: 'asc' } }],
  });

  return memberships.map((m) => ({
    tenantSlug: m.tenant.tenantSlug,
    role: m.role
      ? {
          id: m.role.id,
          name: m.role.name,
          description: m.role.description ?? null,
          isSystem: m.role.isSystem,
          tenantId: m.role.tenantId,
          permissions: m.role.permissions.map((rp) => rp.permission.key),
          createdAt: m.role.createdAt.toISOString(),
          updatedAt: m.role.updatedAt.toISOString(),
        }
      : null,
  }));
}

export async function getUserBranchMembershipsForTenantService(params: {
  currentUserId: string;
  currentTenantId: string;
}) {
  const { currentUserId, currentTenantId } = params;

  // Assumes a join table like userBranchMembership with (userId, branchId),
  // and Branch has (id, branchName, tenantId)
  const memberships = await prismaClientInstance.userBranchMembership.findMany({
    where: {
      userId: currentUserId,
      branch: { tenantId: currentTenantId },
    },
    select: {
      branch: { select: { id: true, branchName: true } },
    },
    orderBy: [{ branch: { branchName: 'asc' } }],
  });

  return memberships.map((m) => ({
    branchId: m.branch.id,
    branchName: m.branch.branchName,
  }));
}