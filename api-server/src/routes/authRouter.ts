import { Router } from 'express'
import { z } from 'zod'
import { createStandardSuccessResponse } from '../utils/standardResponse.js'
import { Errors } from '../utils/httpErrors.js'
import { validateRequestBodyWithZod } from '../middleware/zodValidation.js'
import { createSignedSessionToken, getSessionCookieName, verifySignedSessionToken } from '../utils/sessionCookie.js'
import { verifyUserCredentialsForTenantService, getUserMembershipsService } from '../services/authService.js'
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js'

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

      const cookieName = getSessionCookieName()
      const isProduction = process.env.NODE_ENV === 'production'

      response.cookie(cookieName, sessionTokenValue, {
        httpOnly: true,
        sameSite: isProduction ? 'lax' : 'lax',
        secure: isProduction,           // set true in prod (HTTPS)
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,       // 60 minutes
      })

      return response.status(200).json(createStandardSuccessResponse({ isSignedIn: true }))
    } catch (error) {
      return next(error)
    }
  }
)

authRouter.post('/sign-out', (request, response) => {
  const cookieName = getSessionCookieName()
  response.clearCookie(cookieName, { path: '/' })
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

      // Reuse sign-in path to ensure membership exists
      const decoded = verifySignedSessionToken(request.cookies?.[getSessionCookieName()] ?? '')
      if (!decoded) return next(Errors.authRequired())

      const verified = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: (await (async () => {
          // Fetch email for current user for a quick membership check
          // (we avoid storing email in the token to keep it small)
          // In a real app you might cache this.
          return ''
        })()),
        userPlainTextPasswordInputValue: 'unused', // not needed for switch
        tenantSlugInputValue: tenantSlug,
      })
      // ^ The above is a placeholder; we’ll implement a proper membership-only check below.
      // Simpler: check membership directly:

      // Proper membership-only check:
      // SELECT the tenant by slug and membership for current user
      // (Let’s do it here to avoid refactoring service yet.)
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      const tenant = await prisma.tenant.findUnique({ where: { tenantSlug }, select: { id: true } })
      if (!tenant) return next(Errors.notFound('Tenant not found.'))
      const member = await prisma.userTenantMembership.findUnique({
        where: { userId_tenantId: { userId: decoded.currentUserId, tenantId: tenant.id } },
        select: { userId: true }
      })
      if (!member) return next(Errors.permissionDenied())

      // Create a new token with the switched tenant
      const sessionTokenValue = createSignedSessionToken({
        currentUserId: decoded.currentUserId,
        currentTenantId: tenant.id,
        issuedAtUnixSeconds: Math.floor(Date.now() / 1000),
      })
      const cookieName = getSessionCookieName()
      const isProduction = process.env.NODE_ENV === 'production'
      response.cookie(cookieName, sessionTokenValue, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        maxAge: 60 * 60 * 1000,
      })
      return response.status(200).json(createStandardSuccessResponse({ hasSwitchedTenant: true }))
    } catch (error) {
      return next(error)
    }
  }
)
