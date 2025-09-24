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

// ESM dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// OpenAPI (unchanged)
const openapiPath = path.resolve(__dirname, "../openapi.yaml");
try {
  const raw = fs.readFileSync(openapiPath, "utf8");
  const openapiDoc = yaml.parse(raw);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
  app.get("/openapi.yaml", (_req, res) => res.sendFile(openapiPath));
} catch (err) {
  console.warn(`[docs] Could not load OpenAPI at ${openapiPath}:`, err);
  app.get("/docs", (_req, res) =>
    res.status(503).json({ error: "API docs unavailable" })
  );
}

// ---------- API (now under /api) ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "server" });
});

// dev helper
app.get("/api/dev/tenants", async (_req, res, next) => {
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

// tenant routes
app.use("/api/t/:tenantSlug", tenantContext, tenantRouter);

// (optional) demo
app.get("/api/demo/:tenant", (req, res) => {
  res.json({ message: `Hello from server for tenant: ${req.params.tenant}` });
});

// ---------- Static frontend ----------
const staticDir = path.resolve(__dirname, "./public");
app.use(express.static(staticDir));

// SPA fallback: serve index.html for non-API GETs
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not Found" });
  res.sendFile(path.join(staticDir, "index.html"));
});

// Errors last
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
