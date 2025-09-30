// api-server/src/routes/tenantThemeRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import { validateRequestBodyWithZod, validateRequestParamsWithZod } from '../middleware/zodValidation.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requireRoleAtLeastMiddleware } from '../middleware/rbacMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import {
  ensureTenantIdForSlugAndSession,
  getTenantThemeService,
  upsertTenantThemeService,
} from '../services/tenantThemeService.js';

// --- Zod shapes (mirror your frontend types) ---

// #RRGGBB
const hex = z.string().regex(/^#(?:[0-9a-fA-F]{6})$/);

// Mantine 10-step palette
const palette10 = z.array(hex).length(10);

// Theme overrides
const themeOverridesSchema = z.object({
  // NOTE: colorScheme is ignored by Mantine v7 theme object; keep for future if needed
  colorScheme: z.enum(['light', 'dark']).optional(),
  primaryColor: z.string().optional(),
  primaryShade: z.union([
    z.number().int().min(0).max(9),
    z.object({
      light: z.number().int().min(0).max(9).optional(),
      dark:  z.number().int().min(0).max(9).optional(),
    })
  ]).optional(),
  colors: z.record(z.string(), palette10).optional(),      // { [name]: string[10] }
  defaultRadius: z.string().regex(/^\d+px$/).optional(),
  fontFamily: z.string().max(200).optional(),
}).strict().partial();

// Keep this in sync with your frontend PresetKey list
const presetKeySchema = z.enum([
  'classicBlue',
  'rubyDark',
  'emeraldLight',
  'oceanLight',
  'violetLight',
  'grapeDark',
  'tealDark',
  'cyanLight',
  'orangeLight',
  'limeLight',
  'pinkDark',
  'yellowLight',
]);

const paramsSchema = z.object({ tenantSlug: z.string().min(1) });

const putBodySchema = z.object({
  presetKey: presetKeySchema.nullable().optional(),
  overrides: themeOverridesSchema.optional(),
  logoUrl: z.string().url().max(2048).nullable().optional(),
}).strict();

// --- Router ---

export const tenantThemeRouter = Router();

tenantThemeRouter.get(
  '/:tenantSlug/theme',
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware('VIEWER'),
  validateRequestParamsWithZod(paramsSchema),
  async (req, res, next) => {
    try {
      const { tenantSlug } = req.validatedParams as z.infer<typeof paramsSchema>;
      const tenantId = await ensureTenantIdForSlugAndSession(tenantSlug, req.currentTenantId);
      const payload = await getTenantThemeService(tenantId);
      return res.json(createStandardSuccessResponse(payload));
    } catch (err) {
      return next(err);
    }
  }
);

tenantThemeRouter.put(
  '/:tenantSlug/theme',
  idempotencyMiddleware(60),
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware('ADMIN'),
  validateRequestParamsWithZod(paramsSchema),
  validateRequestBodyWithZod(putBodySchema),
  async (req, res, next) => {
    try {
      const { tenantSlug } = req.validatedParams as z.infer<typeof paramsSchema>;
      const { presetKey, overrides, logoUrl } = req.validatedBody as z.infer<typeof putBodySchema>;
      const tenantId = await ensureTenantIdForSlugAndSession(tenantSlug, req.currentTenantId);
      const payload = await upsertTenantThemeService({ tenantId, presetKey, overrides, logoUrl });
      return res.json(createStandardSuccessResponse(payload));
    } catch (err) {
      return next(err);
    }
  }
);