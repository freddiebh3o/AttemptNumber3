import { Router } from "express";

const router = Router({ mergeParams: true });

router.get("/ping", (req, res) => {
  res.json({
    ok: true,
    tenant: req.context?.tenantSlug,
    tenantId: req.context?.tenantId,
  });
});

export default router;
