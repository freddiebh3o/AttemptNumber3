// api-server/src/services/tenantUserService.ts
import { RoleName } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Errors } from '../utils/httpErrors.js'
import { prismaClientInstance } from '../db/prismaClient.js'

type SortField = 'createdAt' | 'updatedAt' | 'userEmailAddress' | 'roleName'
type SortDir = 'asc' | 'desc'

type ListUsersArgs = {
  currentTenantId: string
  limitOptional?: number
  cursorIdOptional?: string
  // filters
  qOptional?: string
  roleNameOptional?: RoleName
  createdAtFromOptional?: string // 'YYYY-MM-DD'
  createdAtToOptional?: string   // 'YYYY-MM-DD'
  updatedAtFromOptional?: string // 'YYYY-MM-DD'
  updatedAtToOptional?: string   // 'YYYY-MM-DD'
  // sort
  sortByOptional?: SortField
  sortDirOptional?: SortDir
  includeTotalOptional?: boolean
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

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


export async function listUsersForCurrentTenantService(args: ListUsersArgs) {
  const {
    currentTenantId,
    limitOptional,
    cursorIdOptional,
    qOptional,
    roleNameOptional,
    createdAtFromOptional,
    createdAtToOptional,
    updatedAtFromOptional,
    updatedAtToOptional,
    sortByOptional,
    sortDirOptional,
    includeTotalOptional,
  } = args

  const limit = Math.min(Math.max(limitOptional ?? 20, 1), 100)
  const sortBy: SortField = sortByOptional ?? 'createdAt'
  const sortDir: SortDir = sortDirOptional ?? 'desc'

  // Build nested user filter (email + dates)
  let userFilter: any = {}
  if (qOptional && qOptional.trim()) {
    userFilter.userEmailAddress = { contains: qOptional.trim(), mode: 'insensitive' }
  }

  let createdAtFilter: any = {}
  if (createdAtFromOptional) {
    const from = new Date(createdAtFromOptional)
    if (!isNaN(from.getTime())) createdAtFilter.gte = from
  }
  if (createdAtToOptional) {
    const to = new Date(createdAtToOptional)
    if (!isNaN(to.getTime())) createdAtFilter.lt = addDays(to, 1) // inclusive end
  }
  if (Object.keys(createdAtFilter).length) {
    userFilter = { ...userFilter, createdAt: createdAtFilter }
  }

  let updatedAtFilter: any = {}
  if (updatedAtFromOptional) {
    const from = new Date(updatedAtFromOptional)
    if (!isNaN(from.getTime())) updatedAtFilter.gte = from
  }
  if (updatedAtToOptional) {
    const to = new Date(updatedAtToOptional)
    if (!isNaN(to.getTime())) updatedAtFilter.lt = addDays(to, 1)
  }
  if (Object.keys(updatedAtFilter).length) {
    userFilter = { ...userFilter, updatedAt: updatedAtFilter }
  }

  // Membership-level where
  const where: any = {
    tenantId: currentTenantId,
    ...(roleNameOptional ? { roleName: roleNameOptional } : {}),
    ...(Object.keys(userFilter).length ? { user: userFilter } : {}),
  }

  if (qOptional && qOptional.trim()) {
    where.user = {
      ...(where.user ?? {}),
      userEmailAddress: { contains: qOptional.trim(), mode: 'insensitive' },
    };
  }

  // Primary order + tie-breaker by membership.id
  const orderByPrimary =
    sortBy === 'userEmailAddress'
      ? { user: { userEmailAddress: sortDir } }
      : sortBy === 'roleName'
      ? { roleName: sortDir }
      : sortBy === 'createdAt'
      ? { user: { createdAt: sortDir } }
      : { user: { updatedAt: sortDir } }

  const orderBy: any[] = [orderByPrimary, { id: sortDir }]

  const take = limit + 1

  const rows = await prismaClientInstance.userTenantMembership.findMany({
    where,
    orderBy,
    take,
    ...(cursorIdOptional && { cursor: { id: cursorIdOptional }, skip: 1 }),
    select: {
      id: true,            // for cursor
      roleName: true,
      user: {
        select: {
          id: true,
          userEmailAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  const hasNextPage = rows.length > limit
  const slice = hasNextPage ? rows.slice(0, limit) : rows
  const nextCursor = hasNextPage ? slice[slice.length - 1]?.id ?? null : null

  let totalCount: number | undefined
  if (includeTotalOptional) {
    totalCount = await prismaClientInstance.userTenantMembership.count({ where })
  }

  return {
    items: slice.map((m) => ({
      userId: m.user.id,
      userEmailAddress: m.user.userEmailAddress,
      roleName: m.roleName,
      createdAt: m.user.createdAt.toISOString(),
      updatedAt: m.user.updatedAt.toISOString(),
    })),
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(totalCount !== undefined && { totalCount }),
    },
    applied: {
      limit,
      sort: { field: sortBy, direction: sortDir },
      filters: {
        ...(qOptional ? { q: qOptional } : {}),
        ...(roleNameOptional ? { roleName: roleNameOptional } : {}),
        ...(createdAtFromOptional ? { createdAtFrom: createdAtFromOptional } : {}),
        ...(createdAtToOptional ? { createdAtTo: createdAtToOptional } : {}),
        ...(updatedAtFromOptional ? { updatedAtFrom: updatedAtFromOptional } : {}),
        ...(updatedAtToOptional ? { updatedAtTo: updatedAtToOptional } : {}),
      },
    },
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
