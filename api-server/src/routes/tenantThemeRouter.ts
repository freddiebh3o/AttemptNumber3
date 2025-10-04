// api-server/src/routes/tenantThemeRouter.ts
import { Router } from 'express';
import { z } from 'zod';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import { validateRequestBodyWithZod, validateRequestParamsWithZod } from '../middleware/zodValidation.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { idempotencyMiddleware } from '../middleware/idempotencyMiddleware.js';
import {
  ensureTenantIdForSlugAndSession,
  getTenantThemeService,
  upsertTenantThemeService,
  upsertTenantLogoOnlyService,
} from '../services/tenantThemeService.js';
import multer from 'multer';
import { uploadImageToStorageService } from '../services/uploadService.js';
import { Errors } from '../utils/httpErrors.js';

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

function buildAuditCtx(req: any) {
  return {
    actorUserId: req.currentUserId ?? null,
    correlationId: (req.headers['x-correlation-id'] as string | undefined) ?? null,
    ip: (req.ip ?? null) as string | null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  };
}

/** POST /api/tenants/:tenantSlug/logo  (admin+) */
tenantThemeRouter.post(
  '/:tenantSlug/logo',
  idempotencyMiddleware(60),
  requireAuthenticatedUserMiddleware,
  requirePermission('theme:manage'),
  validateRequestParamsWithZod(paramsSchema),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { tenantSlug } = req.validatedParams as z.infer<typeof paramsSchema>;
      const tenantId = await ensureTenantIdForSlugAndSession(tenantSlug, req.currentTenantId);

      const file = req.file;
      if (!file) return next(Errors.validation('Missing file (field: "file")'));

      // Optional: basic mime/type check
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
      if (!allowed.includes(file.mimetype)) {
        return next(Errors.validation('Unsupported file type', `Allowed types: ${allowed.join(', ')}`));
      }

      const out = await uploadImageToStorageService({
        tenantId,
        kind: 'logo',
        bytes: file.buffer,
        contentType: file.mimetype,
        originalName: file.originalname,
        upsert: true,
      });

      const payload = await upsertTenantLogoOnlyService({
        tenantId,
        logoUrl: out.url,
        auditContextOptional: buildAuditCtx(req),
      });

      return res.json(
        createStandardSuccessResponse({
          ...payload,
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
  requirePermission('theme:manage'),
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
  requirePermission('theme:manage'),
  validateRequestParamsWithZod(paramsSchema),
  validateRequestBodyWithZod(putBodySchema),
  async (req, res, next) => {
    try {
      const { tenantSlug } = req.validatedParams as z.infer<typeof paramsSchema>;
      const { presetKey, overrides, logoUrl } = req.validatedBody as z.infer<typeof putBodySchema>;
      const tenantId = await ensureTenantIdForSlugAndSession(tenantSlug, req.currentTenantId);
      const payload = await upsertTenantThemeService({
        tenantId,
        presetKey,
        overrides,
        logoUrl,
        auditContextOptional: buildAuditCtx(req),
      });
      return res.json(createStandardSuccessResponse(payload));
    } catch (err) {
      return next(err);
    }
  }
);
