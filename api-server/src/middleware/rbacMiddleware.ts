import type { Request, Response, NextFunction } from 'express'
import { prismaClientInstance } from '../db/prismaClient.js'
import { Errors } from '../utils/httpErrors.js'

// Order roles from lowest to highest privilege (VIEWER < EDITOR < ADMIN < OWNER)
const rolePrivilegeRankMap: Record<string, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
}

export function requireRoleAtLeastMiddleware(requiredRoleName: 'VIEWER' | 'EDITOR' | 'ADMIN' | 'OWNER') {
  return async (request: Request, _response: Response, next: NextFunction) => {
    const currentUserId: string | undefined = request.currentUserId
    const currentTenantId: string | undefined = request.currentTenantId
    if (!currentUserId || !currentTenantId) return next(Errors.authRequired())

    const membershipRecord = await prismaClientInstance.userTenantMembership.findUnique({
      where: { userId_tenantId: { userId: currentUserId, tenantId: currentTenantId } },
      select: { roleName: true },
    })
    if (!membershipRecord) return next(Errors.permissionDenied())

    const currentRoleRank = rolePrivilegeRankMap[membershipRecord.roleName] ?? 0
    const requiredRoleRank = rolePrivilegeRankMap[requiredRoleName] ?? 999
    if (currentRoleRank < requiredRoleRank) return next(Errors.permissionDenied())

    return next()
  }
}
