// apps/server/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../auth/jwt";
import type { SessionUser } from "@acme/types";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const payload = await verifyAuthToken(token);

    // tenant guardrail: token must match the path tenant
    if (!req.context || payload.tenantId !== req.context.tenantId) {
      return res.status(403).json({ error: "Token tenant mismatch" });
    }

    const user: SessionUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId as any,   // your shared branded type
      tenantSlug: payload.tenantSlug
    };

    req.context.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
