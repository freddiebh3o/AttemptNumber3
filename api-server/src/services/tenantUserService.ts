// api-server/src/services/tenantUserService.ts
import { PrismaClient, RoleName } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Errors } from '../utils/httpErrors.js'
const prismaClientInstance = new PrismaClient()


async function countOwners(tenantId: string) {
  return prismaClientInstance.userTenantMembership.count({
    where: { tenantId, roleName: 'OWNER' },
  })
}

async function isOwner(tenantId: string, userId: string) {
  const m = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { tenantId, userId } },
    select: { roleName: true },
  })
  return m?.roleName === 'OWNER'
}


export async function listUsersForCurrentTenantService(params: {
  currentTenantId: string
  limitOptional?: number
  cursorIdOptional?: string
}) {
  const take = params.limitOptional ?? 50

  const memberships = await prismaClientInstance.userTenantMembership.findMany({
    where: { tenantId: params.currentTenantId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
    take,
    ...(params.cursorIdOptional && { cursor: { id: params.cursorIdOptional }, skip: 1 }),
  })

  const nextCursorId = memberships.length === take ? memberships[memberships.length - 1]?.id : undefined

  return {
    users: memberships.map((m) => ({
      userId: m.userId,
      userEmailAddress: m.user.userEmailAddress,
      roleName: m.roleName,
      // createdAt/updatedAt are often useful in admin lists:
      createdAt: m.user.createdAt.toISOString(),
      updatedAt: m.user.updatedAt.toISOString(),
    })),
    nextCursorId,
  }
}

/**
 * Create (or attach) a user to the current tenant with a role.
 * If a user with the same email exists, we attach membership (idempotent-ish).
 */
export async function createOrAttachUserToTenantService(params: {
  currentTenantId: string
  email: string
  password: string
  roleName: RoleName
}) {
  // Find existing user by email, else create
  const existingUser = await prismaClientInstance.user.findUnique({
    where: { userEmailAddress: params.email },
  })

  let userId: string
  if (!existingUser) {
    const hashed = await bcrypt.hash(params.password, 10)
    const user = await prismaClientInstance.user.create({
      data: {
        userEmailAddress: params.email,
        userHashedPassword: hashed,
      },
    })
    userId = user.id
  } else {
    userId = existingUser.id
  }

  // Upsert membership for this tenant
  const membership = await prismaClientInstance.userTenantMembership.upsert({
    where: { userId_tenantId: { userId, tenantId: params.currentTenantId } },
    update: { roleName: params.roleName },
    create: {
      userId,
      tenantId: params.currentTenantId,
      roleName: params.roleName,
    },
  })

  return {
    userId,
    userEmailAddress: (existingUser?.userEmailAddress ?? params.email),
    roleName: membership.roleName,
  }
}

export async function updateTenantUserService(params: {
  currentTenantId: string
  currentUserId: string            // ← NEW: who is performing the action
  targetUserId: string
  newEmailOptional?: string
  newPasswordOptional?: string
  newRoleNameOptional?: RoleName
}) {
  const { currentTenantId, currentUserId, targetUserId } = params

  const membership = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
  })
  if (!membership) throw Errors.notFound('User is not a member of this tenant.')

  // If changing role away from OWNER, protect the last OWNER
  if (params.newRoleNameOptional && membership.roleName === 'OWNER' && params.newRoleNameOptional !== 'OWNER') {
    const owners = await countOwners(currentTenantId)
    if (owners <= 1) throw Errors.cantDeleteLastOwner()
    // Optional: prevent self-demotion if that would leave you without OWNER—already covered by owners<=1
  }

  // Apply membership role change first
  if (params.newRoleNameOptional !== undefined) {
    await prismaClientInstance.userTenantMembership.update({
      where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
      data: { roleName: params.newRoleNameOptional },
    })
  }

  // Optional: prevent user from locking themselves out by demoting own role below ADMIN
  // (skip if you don't want this)
  if (targetUserId === currentUserId) {
    // nothing else to do—role change has already been applied safely
  }

  // Update user’s email/password
  if (params.newEmailOptional !== undefined || params.newPasswordOptional !== undefined) {
    const data: { userEmailAddress?: string; userHashedPassword?: string } = {}
    if (params.newEmailOptional !== undefined) data.userEmailAddress = params.newEmailOptional
    if (params.newPasswordOptional !== undefined) {
      data.userHashedPassword = await bcrypt.hash(params.newPasswordOptional, 10)
    }
    await prismaClientInstance.user.update({ where: { id: targetUserId }, data })
  }

  const user = await prismaClientInstance.user.findUnique({ where: { id: targetUserId } })
  const updatedMembership = await prismaClientInstance.userTenantMembership.findUnique({
    where: { userId_tenantId: { userId: targetUserId, tenantId: currentTenantId } },
  })
  if (!user || !updatedMembership) throw Errors.internal('State mismatch after update.')

  return {
    userId: user.id,
    userEmailAddress: user.userEmailAddress,
    roleName: updatedMembership.roleName,
    updatedAt: user.updatedAt.toISOString(),
  }
}
/**
 * Remove a user from the current tenant.
 * If that was their last membership, we keep the user record (simple POC decision).
 */

export async function removeUserFromTenantService(params: {
  currentTenantId: string
  currentUserId: string           // ← NEW
  targetUserId: string
}) {
  const { currentTenantId, currentUserId, targetUserId } = params

  // If removing an OWNER, ensure there’s at least one other OWNER
  if (await isOwner(currentTenantId, targetUserId)) {
    const owners = await countOwners(currentTenantId)
    if (owners <= 1) throw Errors.cantDeleteLastOwner()
  }

  // Optional: block self-removal if you’re the last OWNER
  if (currentUserId === targetUserId) {
    // already covered by the check above when they are OWNER
  }

  const deleted = await prismaClientInstance.userTenantMembership.deleteMany({
    where: { userId: targetUserId, tenantId: currentTenantId },
  })

  return { hasRemovedMembership: deleted.count > 0 }
}
