// src/routes/authRouter.ts
import { Router } from 'express'
import { z } from 'zod'
import { createStandardSuccessResponse } from '../utils/standardResponse.js'
import { Errors } from '../utils/httpErrors.js'
import { validateRequestBodyWithZod } from '../middleware/zodValidation.js'
import {
  createSignedSessionToken,
  verifySignedSessionToken,
  setSignedSessionCookie,
  clearSessionCookie,
} from '../utils/sessionCookie.js'
import {
  verifyUserCredentialsForTenantService,
  getUserMembershipsService,
} from '../services/authService.js'
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js'
import { PrismaClient } from '@prisma/client'

export const authRouter = Router()

const signInBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(1),
})

authRouter.post(
  '/sign-in',
  validateRequestBodyWithZod(signInBodySchema),
  async (request, response, next) => {
    try {
      const { email, password, tenantSlug } = (request as any).validatedBody as z.infer<typeof signInBodySchema>

      const verified = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: email,
        userPlainTextPasswordInputValue: password,
        tenantSlugInputValue: tenantSlug,
      })
      if (!verified) {
        return next(Errors.validation('Invalid email, password, or tenant membership'))
      }

      const sessionTokenValue = createSignedSessionToken({
        currentUserId: verified.matchedUserId,
        currentTenantId: verified.matchedTenantId,
        issuedAtUnixSeconds: Math.floor(Date.now() / 1000),
      })

      setSignedSessionCookie(response, sessionTokenValue)

      return response.status(200).json(createStandardSuccessResponse({ isSignedIn: true }))
    } catch (error) {
      return next(error)
    }
  }
)

authRouter.post('/sign-out', (_request, response) => {
  clearSessionCookie(response)
  return response.status(200).json(createStandardSuccessResponse({ isSignedIn: false }))
})

authRouter.get('/me', requireAuthenticatedUserMiddleware, async (request, response, next) => {
  try {
    const currentUserId: string = (request as any).currentUserId
    const currentTenantId: string = (request as any).currentTenantId

    const memberships = await getUserMembershipsService({ currentUserId })
    return response.status(200).json(createStandardSuccessResponse({
      currentUserId,
      currentTenantId,
      tenantMemberships: memberships,
    }))
  } catch (error) {
    return next(error)
  }
})

const switchTenantBodySchema = z.object({
  tenantSlug: z.string().min(1),
})

authRouter.post(
  '/switch-tenant',
  requireAuthenticatedUserMiddleware,
  validateRequestBodyWithZod(switchTenantBodySchema),
  async (request, response, next) => {
    try {
      const { tenantSlug } = (request as any).validatedBody as z.infer<typeof switchTenantBodySchema>

      // Verify current token so we can reuse the user id
      const decoded = verifySignedSessionToken(request.cookies?.['mt_session'] ?? '')
      if (!decoded) return next(Errors.authRequired())

      // Membership-only check
      const prisma = new PrismaClient()
      const tenant = await prisma.tenant.findUnique({ where: { tenantSlug }, select: { id: true } })
      if (!tenant) return next(Errors.notFound('Tenant not found.'))
      const member = await prisma.userTenantMembership.findUnique({
        where: { userId_tenantId: { userId: decoded.currentUserId, tenantId: tenant.id } },
        select: { userId: true },
      })
      if (!member) return next(Errors.permissionDenied())

      // Issue a new token for the switched tenant
      const sessionTokenValue = createSignedSessionToken({
        currentUserId: decoded.currentUserId,
        currentTenantId: tenant.id,
        issuedAtUnixSeconds: Math.floor(Date.now() / 1000),
      })
      setSignedSessionCookie(response, sessionTokenValue)

      return response.status(200).json(createStandardSuccessResponse({ hasSwitchedTenant: true }))
    } catch (error) {
      return next(error)
    }
  }
)
