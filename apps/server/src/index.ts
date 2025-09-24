// apps/server/src/index.ts
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

// Health check — helpful for CI and uptime monitors
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "server" });
});

// Tiny demo route to prove shared types import
// import type { TenantSlug } from "@acme/types";
import type { TenantSlug } from "@acme/types";
app.get("/demo/:tenant", (req, res) => {
  const tenant = req.params.tenant as TenantSlug;
  res.json({ message: `Hello from server for tenant: ${tenant}` });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
