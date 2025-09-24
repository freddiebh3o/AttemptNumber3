// apps/server/src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db";
import { tenantContext } from "./middleware/tenantContext";
import tenantRouter from "./routes/tenant";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import swaggerUi from "swagger-ui-express";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { fileURLToPath } from "node:url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestId);

// Resolve OpenAPI path relative to this file (works in dev and after build)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiPath = path.resolve(__dirname, "../openapi.yaml");

try {
  const raw = fs.readFileSync(openapiPath, "utf8");
  const openapiDoc = yaml.parse(raw);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
  // (Optional) serve raw spec too
  app.get("/openapi.yaml", (_req, res) => res.sendFile(openapiPath));
} catch (err) {
  console.warn(`[docs] Could not load OpenAPI at ${openapiPath}:`, err);
  app.get("/docs", (_req, res) =>
    res.status(503).json({ error: "API docs unavailable" })
  );
}

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "server" });
});

// Dev helper
app.get("/dev/tenants", async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, slug: true, name: true, createdAt: true },
      orderBy: { slug: "asc" },
    });
    res.json({ tenants });
  } catch (e) {
    next(e);
  }
});

// Tenant-scoped routes
app.use("/t/:tenantSlug", tenantContext, tenantRouter);

// Demo
app.get("/demo/:tenant", (req, res) => {
  res.json({ message: `Hello from server for tenant: ${req.params.tenant}` });
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

// Central error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
