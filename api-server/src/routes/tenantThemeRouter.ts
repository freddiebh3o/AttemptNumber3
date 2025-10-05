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
} from '../services/theme/tenantThemeService.js';
import multer from 'multer';
import { uploadImageToStorageService } from '../services/uploadService.js';
import { Errors } from '../utils/httpErrors.js';
import { validateRequestQueryWithZod } from '../middleware/zodValidation.js';
import { getTenantThemeActivityForCurrentTenantService } from '../services/theme/tenantThemeActivityService.js';
import { getAuditContext } from '../utils/auditContext.js';

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

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  actorIds: z.string().min(1).optional(), // CSV of user IDs
  includeFacets: z.coerce.boolean().optional(),
  includeTotal: z.coerce.boolean().optional(),
});

// --- Router ---

export const tenantThemeRouter = Router();

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
        auditContextOptional: getAuditContext(req),
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

/** GET /api/tenants/:tenantSlug/theme */
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

/** PUT /api/tenants/:tenantSlug/theme */
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
        auditContextOptional: getAuditContext(req),
      });
      return res.json(createStandardSuccessResponse(payload));
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /api/tenants/:tenantSlug/theme/activity */
tenantThemeRouter.get(
  '/:tenantSlug/theme/activity',
  requireAuthenticatedUserMiddleware,
  requirePermission('theme:manage'),
  validateRequestParamsWithZod(paramsSchema),
  validateRequestQueryWithZod(activityQuerySchema),
  async (req, res, next) => {
    try {
      const { tenantSlug } = req.validatedParams as z.infer<typeof paramsSchema>;
      const {
        limit, cursor, occurredFrom, occurredTo, actorIds, includeFacets, includeTotal,
      } = req.validatedQuery as z.infer<typeof activityQuerySchema>;

      const tenantId = await ensureTenantIdForSlugAndSession(tenantSlug, req.currentTenantId);

      const data = await getTenantThemeActivityForCurrentTenantService({
        currentTenantId: tenantId,
        ...(limit !== undefined ? { limitOptional: limit } : {}),
        ...(cursor !== undefined ? { cursorOptional: cursor } : {}),
        ...(occurredFrom !== undefined ? { occurredFromOptional: occurredFrom } : {}),
        ...(occurredTo !== undefined ? { occurredToOptional: occurredTo } : {}),
        ...(actorIds
          ? { actorIdsOptional: actorIds.split(',').map(s => s.trim()).filter(Boolean) }
          : {}),
        ...(includeFacets !== undefined ? { includeFacetsOptional: includeFacets } : {}),
        ...(includeTotal !== undefined ? { includeTotalOptional: includeTotal } : {}),
      });

      return res.json(createStandardSuccessResponse(data));
    } catch (err) {
      return next(err);
    }
  }
);