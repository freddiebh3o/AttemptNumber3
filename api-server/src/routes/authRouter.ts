// src/routes/authRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import { Errors } from '../utils/httpErrors.js';
import { validateRequestBodyWithZod } from '../middleware/zodValidation.js';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
  setSignedSessionCookie,
  clearSessionCookie,
} from '../utils/sessionCookie.js';
import {
  verifyUserCredentialsForTenantService,
  getUserMembershipsService,
} from '../services/authService.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { PrismaClient } from '@prisma/client';
import { assertAuthed } from '../types/assertions.js';

export const authRouter = Router();

const signInBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(1),
});

authRouter.post(
  '/sign-in',
  validateRequestBodyWithZod(signInBodySchema),
  async (request, response, next) => {
    try {
      const { email, password, tenantSlug } = request.validatedBody as z.infer<typeof signInBodySchema>;

      const verified = await verifyUserCredentialsForTenantService({
        userEmailAddressInputValue: email,
        userPlainTextPasswordInputValue: password,
        tenantSlugInputValue: tenantSlug,
      });
      if (!verified) {
        return next(Errors.validation('Invalid email, password, or tenant membership'));
      }

      const sessionTokenValue = createSignedSessionToken({
        currentUserId: verified.matchedUserId,
        currentTenantId: verified.matchedTenantId,
        issuedAtUnixSeconds: Math.floor(Date.now() / 1000),
      });

      setSignedSessionCookie(response, sessionTokenValue);

      return response.status(200).json(createStandardSuccessResponse({ isSignedIn: true }));
    } catch (error) {
      return next(error);
    }
  }
);

authRouter.post('/sign-out', (_request, response) => {
  clearSessionCookie(response);
  return response.status(200).json(createStandardSuccessResponse({ isSignedIn: false }));
});

authRouter.get('/me', requireAuthenticatedUserMiddleware, async (request, response, next) => {
  try {
    assertAuthed(request);
    const currentUserId: string = request.currentUserId;
    const currentTenantId: string = request.currentTenantId;

    const prisma = new PrismaClient();

    // 1) user { id, userEmailAddress }
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, userEmailAddress: true },
    });
    if (!user) return next(Errors.authRequired());

    // 2) All memberships with full role objects
    const tenantMemberships = await getUserMembershipsService({ currentUserId });

    // 3) Current tenant block: { tenantId, tenantSlug, role }
    let currentTenant: {
      tenantId: string;
      tenantSlug: string;
      role: null | {
        id: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        tenantId: string;
        permissions: string[];
        createdAt: string;
        updatedAt: string;
      };
    } | null = null;

    const tenant = await prisma.tenant.findUnique({
      where: { id: currentTenantId },
      select: { id: true, tenantSlug: true },
    });

    if (tenant) {
      const membership = await prisma.userTenantMembership.findUnique({
        where: { userId_tenantId: { userId: currentUserId, tenantId: tenant.id } },
        select: {
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
      });

      currentTenant = {
        tenantId: tenant.id,
        tenantSlug: tenant.tenantSlug,
        role: membership?.role
          ? {
              id: membership.role.id,
              name: membership.role.name,
              description: membership.role.description ?? null,
              isSystem: membership.role.isSystem,
              tenantId: membership.role.tenantId ?? '',
              permissions: membership.role.permissions.map((rp) => rp.permission.key),
              createdAt: membership.role.createdAt.toISOString(),
              updatedAt: membership.role.updatedAt.toISOString(),
            }
          : null,
      };
    }

    // 4) Convenience array for the active tenant’s permissions
    const permissionsCurrentTenant =
      currentTenant?.role?.permissions ? [...currentTenant.role.permissions].sort() : [];

    return response
      .status(200)
      .json(
        createStandardSuccessResponse({
          user,                 // { id, userEmailAddress }
          tenantMemberships,    // [{ tenantSlug, role: { id, name, description?, isSystem, permissions[] ... } | null }]
          currentTenant,        // { tenantId, tenantSlug, role }
          permissionsCurrentTenant,
        })
      );
  } catch (error) {
    return next(error);
  }
});

const switchTenantBodySchema = z.object({
  tenantSlug: z.string().min(1),
});

authRouter.post(
  '/switch-tenant',
  requireAuthenticatedUserMiddleware,
  validateRequestBodyWithZod(switchTenantBodySchema),
  async (request, response, next) => {
    try {
      const { tenantSlug } = request.validatedBody as z.infer<typeof switchTenantBodySchema>;

      const decoded = verifySignedSessionToken(request.cookies?.['mt_session'] ?? '');
      if (!decoded) return next(Errors.authRequired());

      const prisma = new PrismaClient();
      const tenant = await prisma.tenant.findUnique({ where: { tenantSlug }, select: { id: true } });
      if (!tenant) return next(Errors.notFound('Tenant not found.'));

      const member = await prisma.userTenantMembership.findUnique({
        where: { userId_tenantId: { userId: decoded.currentUserId, tenantId: tenant.id } },
        select: { userId: true },
      });
      if (!member) return next(Errors.permissionDenied());

      const sessionTokenValue = createSignedSessionToken({
        currentUserId: decoded.currentUserId,
        currentTenantId: tenant.id,
        issuedAtUnixSeconds: Math.floor(Date.now() / 1000),
      });
      setSignedSessionCookie(response, sessionTokenValue);

      return response.status(200).json(createStandardSuccessResponse({ hasSwitchedTenant: true }));
    } catch (error) {
      return next(error);
    }
  }
);
