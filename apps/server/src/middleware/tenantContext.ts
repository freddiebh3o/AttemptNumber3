// apps/server/src/middleware/tenantContext.ts
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db";

export async function tenantContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const slug = req.params.tenantSlug;
  if (!slug) {
    return res.status(400).json({ error: "Missing tenant slug in path." });
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    return res.status(404).json({ error: "Unknown tenant." });
  }

  req.context = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    // user will be attached in Phase 3
  };

  next();
}
