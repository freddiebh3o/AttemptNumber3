// api-server/src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { requestIdMiddleware } from "./middleware/requestIdMiddleware.js";
import { sessionMiddleware } from "./middleware/sessionMiddleware.js";
import { standardErrorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import { httpLoggingMiddleware } from "./middleware/httpLoggingMiddleware.js";
import { buildOpenApiDocument } from "./openapi/index.js";
import { createFixedWindowRateLimiterMiddleware } from "./middleware/rateLimiterMiddleware.js";

export function createConfiguredExpressApplicationInstance() {
  const app = express();
  const openApiDocument = buildOpenApiDocument();

  // Trust Render/Proxy so req.ip is the real client IP
  app.set("trust proxy", true);

  // --- CORS (must be early and before any rate limiting) ---
  const allowedOrigins = [
    process.env.FRONTEND_DEV_ORIGIN || "http://localhost:5174",
    process.env.FRONTEND_ORIGIN,
    "http://127.0.0.1:5174",
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // curl/Postman
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Not allowed by CORS: ${origin}`));
      },
      credentials: true,
    })
  );

  // --- Security headers ---
  app.use(helmet());

  // --- Core middleware ---
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestIdMiddleware);
  app.use((req, res, next) => {
    const id = req.correlationId ?? null;
    if (id) {
      res.setHeader('X-Request-Id', String(id));
      res.setHeader('X-Correlation-Id', String(id));
    }
    next();
  });
  app.use(httpLoggingMiddleware);
  app.use(sessionMiddleware);

  // --- Public docs (no rate limiting) ---
  app.get("/openapi.json", (_req, res) => res.json(openApiDocument));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // --- Rate limiters (scoped) ---
  const authLimiter = createFixedWindowRateLimiterMiddleware({
    windowSeconds: 60,
    limit: 120,                 // ↑ from 20 → 120; adjust to taste
    bucketScope: "ip+session",
    name: "auth",               // ← NEW
    // Skip lightweight reads that may happen frequently in the background
    skip: (req) =>
      req.method === "GET" &&
      (
        req.path === "/api/auth/me" ||
        req.path === "/api/auth/session" ||
        req.path === "/api/auth/refresh"
      ),
  });

  const generalLimiter = createFixedWindowRateLimiterMiddleware({
    windowSeconds: 60,
    limit: 600, 
    bucketScope: "ip+session", 
    name: "general",
  });

  // Mount specific first, then general
  app.use("/api/auth", authLimiter);
  app.use("/api", generalLimiter);

  // --- Routes ---
  app.use("/api", apiRouter);

  // 404 envelope for unmatched API routes
  app.use("/api", (req, res) => {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        errorCode: "RESOURCE_NOT_FOUND",
        httpStatusCode: 404,
        userFacingMessage: "The requested resource was not found.",
        developerMessage: "No matching route.",
        correlationId: req.correlationId ?? null,
      },
    });
  });

  // Central error handler (must be last)
  app.use(standardErrorHandler);

  const serverPortFromEnvironmentVariable: number = Number(
    process.env.SERVER_PORT || 4000
  );
  return { expressApplicationInstance: app, serverPortFromEnvironmentVariable };
}
