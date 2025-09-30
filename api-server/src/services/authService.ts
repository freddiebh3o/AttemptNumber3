// api-server/src/services/authService.ts
import bcrypt from 'bcryptjs'
import { prismaClientInstance } from '../db/prismaClient.js'


export async function verifyUserCredentialsForTenantService(params: {
  userEmailAddressInputValue: string
  userPlainTextPasswordInputValue: string
  tenantSlugInputValue: string
}): Promise<{ matchedUserId: string; matchedTenantId: string } | null> {
  const { userEmailAddressInputValue, userPlainTextPasswordInputValue, tenantSlugInputValue } = params

  const matchedUserRecord = await prismaClientInstance.user.findUnique({
    where: { userEmailAddress: userEmailAddressInputValue },
    select: { id: true, userHashedPassword: true },
  })
  if (!matchedUserRecord) return null

  const isPasswordValid = await bcrypt.compare(
    userPlainTextPasswordInputValue,
    matchedUserRecord.userHashedPassword
  )
  if (!isPasswordValid) return null

  const matchedTenantRecord = await prismaClientInstance.tenant.findUnique({
    where: { tenantSlug: tenantSlugInputValue },
    select: { id: true },
  })
  if (!matchedTenantRecord) return null

  const membership = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: matchedUserRecord.id, tenantId: matchedTenantRecord.id } },
    select: { userId: true, tenantId: true },
  })
  if (!membership) return null

  return { matchedUserId: membership.userId, matchedTenantId: membership.tenantId }
}

export async function getUserMembershipsService(params: { currentUserId: string }) {
  const { currentUserId } = params
  const memberships = await prismaClientInstance.userTenantMembership.findMany({
    where: { userId: currentUserId },
    select: {
      tenant: { select: { tenantSlug: true, tenantName: true, id: true } },
      roleName: true,
    },
    orderBy: [{ tenant: { tenantSlug: 'asc' } }],
  })
  return memberships.map(m => ({ tenantSlug: m.tenant.tenantSlug, roleName: m.roleName }))
}
