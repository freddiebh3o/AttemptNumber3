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
import multer from 'multer';
import { uploadImageToStorageService } from '../services/uploadService.js';
import { Errors } from '../utils/httpErrors.js';
import { prismaClientInstance } from '../db/prismaClient.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for logos
});

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

/** POST /api/tenants/:tenantSlug/logo  (admin+) */
tenantThemeRouter.post(
  '/:tenantSlug/logo',
  idempotencyMiddleware(60),
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware('ADMIN'),
  validateRequestParamsWithZod(paramsSchema),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { tenantSlug } = req.validatedParams as z.infer<typeof paramsSchema>;
      const tenantId = await ensureTenantIdForSlugAndSession(tenantSlug, req.currentTenantId);

      const file = req.file;
      if (!file) return next(Errors.validation('Missing file (field: "file")'));

      const out = await uploadImageToStorageService({
        tenantId,
        kind: 'logo',
        bytes: file.buffer,
        contentType: file.mimetype,
        originalName: file.originalname,
        upsert: true, // allow replacing the logo path with new file name each time; still unique filename
      });

      const updated = await prismaClientInstance.tenantBranding.upsert({
        where: { tenantId },
        create: { tenantId, logoUrl: out.url, overridesJson: {}, presetKey: null },
        update: { logoUrl: out.url },
        select: { logoUrl: true, updatedAt: true, createdAt: true, overridesJson: true, presetKey: true },
      });

      return res.json(
        createStandardSuccessResponse({
          presetKey: updated.presetKey ?? null,
          overrides: (updated.overridesJson as unknown) ?? {},
          logoUrl: updated.logoUrl ?? null,
          updatedAt: updated.updatedAt,
          createdAt: updated.createdAt,
          upload: out,
        })
      );
    } catch (err) {
      return next(err);
    }
  }
);

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