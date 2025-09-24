import { Router } from "express";
import authRouter from "./auth";
import { requireAuth } from "../middleware/requireAuth";
import postsRouter from "./posts";

const router = Router({ mergeParams: true });

router.get("/ping", (req, res) => {
  res.json({
    ok: true,
    tenant: req.context?.tenantSlug,
    tenantId: req.context?.tenantId,
  });
});

router.use("/auth", authRouter);

router.use("/posts", requireAuth, postsRouter);

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.context?.user });
});

export default router;
