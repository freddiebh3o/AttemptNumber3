// api-server/src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware.js";
import { sessionMiddleware } from "./middleware/sessionMiddleware.js";
import { standardErrorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import helmet from "helmet";

export function createConfiguredExpressApplicationInstance() {
  const expressApplicationInstance = express();

  const frontendDevOriginFromEnvironmentVariable: string =
    process.env.FRONTEND_DEV_ORIGIN || "http://localhost:5173";

  // CORS
  expressApplicationInstance.use(cors({
    origin: (origin, callback) => {
      // Allow no-origin (curl/Postman) and the configured dev origin
      if (!origin || origin === frontendDevOriginFromEnvironmentVariable) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }))

  expressApplicationInstance.use(helmet())

  // Core middleware
  expressApplicationInstance.use(cookieParser());
  expressApplicationInstance.use(express.json({ limit: '64kb' }))
  expressApplicationInstance.use(requestIdMiddleware);
  expressApplicationInstance.use(sessionMiddleware);

  // Routes
  expressApplicationInstance.use("/api", apiRouter);

  // 404 envelope for unmatched API routes
  expressApplicationInstance.use((req, res) => {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        errorCode: "RESOURCE_NOT_FOUND",
        httpStatusCode: 404,
        userFacingMessage: "The requested resource was not found.",
        developerMessage: "No matching route.",
        correlationId: (req as any).correlationId ?? null,
      },
    });
  });

  // Central error handler (must be last)
  expressApplicationInstance.use(standardErrorHandler);

  const serverPortFromEnvironmentVariable: number = Number(
    process.env.SERVER_PORT || 4000
  );
  return { expressApplicationInstance, serverPortFromEnvironmentVariable };
}
