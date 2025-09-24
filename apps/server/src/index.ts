// apps/server/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db";
import { tenantContext } from "./middleware/tenantContext";
import tenantRouter from "./routes/tenant";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "server" });
});

// dev helper from Phase 1 (keep it)
app.get("/dev/tenants", async (_req, res) => {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true, createdAt: true },
    orderBy: { slug: "asc" },
  });
  res.json({ tenants });
});

app.use("/t/:tenantSlug", tenantContext, tenantRouter);

app.get("/demo/:tenant", (req, res) => {
  res.json({ message: `Hello from server for tenant: ${req.params.tenant}` });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
