// api-server/src/middleware/permissionMiddleware.ts
import type { Request, Response, NextFunction } from 'express';
import { Errors } from '../utils/httpErrors.js';
import type { PermissionKey } from '../utils/permissions.js';
import { getPermissionKeysForUserInTenant } from '../services/permissionService.js';

async function ensurePermissionSetOnRequest(req: Request) {
  if (req.currentPermissionKeys) return;

  const userId = req.currentUserId;
  const tenantId = req.currentTenantId;
  if (!userId || !tenantId) throw Errors.authRequired();

  const keys = await getPermissionKeysForUserInTenant({ userId, tenantId });
  req.currentPermissionKeys = keys;
}

export function requirePermission(required: PermissionKey) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await ensurePermissionSetOnRequest(req);
      if (!req.currentPermissionKeys?.has(required)) {
        throw Errors.permissionDenied();
      }
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

export function requireAnyPermission(requiredAny: PermissionKey[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await ensurePermissionSetOnRequest(req);
      const ok = requiredAny.some(k => req.currentPermissionKeys?.has(k));
      if (!ok) {
        throw Errors.permissionDenied();
      }
      return next();
    } catch (e) {
      return next(e);
    }
  };
}
