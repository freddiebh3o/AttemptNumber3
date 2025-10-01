// api-server/src/openapi/components/rbac.ts
import { z } from 'zod';
import { PERMISSION_KEYS } from '../../utils/permissions.js';

// z.enum needs a tuple; we assert the const array safely to a non-empty tuple
export const ZodPermissionKey = z
  .enum(PERMISSION_KEYS as unknown as [typeof PERMISSION_KEYS[number], ...typeof PERMISSION_KEYS[number][]])
  .openapi('PermissionKey');
