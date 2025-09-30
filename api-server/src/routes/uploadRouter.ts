// api-server/src/routes/uploadRouter.ts
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requireRoleAtLeastMiddleware } from '../middleware/rbacMiddleware.js';
import { Errors } from '../utils/httpErrors.js';
import { uploadImageToStorageService, type UploadKind } from '../services/uploadService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB cap; adjust as needed
});

const bodySchema = z.object({
  kind: z.enum(['logo', 'product', 'user', 'misc']).optional(),
});

export const uploadRouter = Router();

/**
 * POST /api/uploads/images
 * FormData: file=<blob>, kind?=logo|product|user|misc
 */
uploadRouter.post(
  '/images',
  requireAuthenticatedUserMiddleware,
  requireRoleAtLeastMiddleware('EDITOR'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return next(Errors.validation('Invalid form data', parsed.error.message));

      const file = req.file;
      if (!file) return next(Errors.validation('Missing file (field: "file")'));

      const tenantId = req.currentTenantId;
      if (!tenantId) return next(Errors.authRequired());

      const kind = (parsed.data.kind ?? 'misc') as UploadKind;

      const out = await uploadImageToStorageService({
        tenantId,
        kind,
        bytes: file.buffer,
        contentType: file.mimetype,
        originalName: file.originalname,
      });

      return res.status(201).json(createStandardSuccessResponse({ upload: out }));
    } catch (err) {
      return next(err);
    }
  }
);
