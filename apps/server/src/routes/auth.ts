// apps/server/src/routes/auth.ts
import { Router } from "express";
import { prisma } from "../db";
import * as bcrypt from "bcryptjs";
import { signAuthToken } from "../auth/jwt";
import { z } from "zod";
import { unauthorized, forbidden } from "../errors";
import { validate } from "../middleware/validate";

const router = Router({ mergeParams: true });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8) // simple baseline
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    if (!req.context) throw forbidden("Missing tenant context");
    const { tenantId, tenantSlug } = req.context;
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid credentials");

    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (!membership) throw forbidden("Not a member of this tenant");

    const token = await signAuthToken({
      sub: user.id,
      email: user.email,
      tenantId,
      tenantSlug,
      role: membership.role,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: membership.role, tenantId, tenantSlug },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
