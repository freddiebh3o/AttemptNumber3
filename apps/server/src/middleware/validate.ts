// apps/server/src/middleware/validate.ts
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { badRequest } from "../errors";

export const validate =
  <S extends z.ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      // Prefer the new tree format; fall back to issues if unavailable
      const details =
        typeof (z as any).treeifyError === "function"
          ?
            (z as any).treeifyError(parsed.error)
          : parsed.error.issues;

      return next(badRequest("Invalid request body", details));
    }

    // typed body for downstream handlers
    req.body = parsed.data as z.infer<S>;
    next();
  };
