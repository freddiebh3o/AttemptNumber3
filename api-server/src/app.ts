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
import { httpLoggingMiddleware } from './middleware/httpLoggingMiddleware.js'
import swaggerUi from 'swagger-ui-express'
import { buildOpenApiDocument } from './openapi/openapi.js'


export function createConfiguredExpressApplicationInstance() {
  const expressApplicationInstance = express();
  const openApiDocument = buildOpenApiDocument()

  const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5174'

  expressApplicationInstance.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true) // allow curl/Postman
      if (origin === allowedOrigin) return callback(null, true)
      return callback(new Error(`Not allowed by CORS: ${origin}`))
    },
    credentials: true,
  }))

  expressApplicationInstance.use(helmet())

  // Core middleware
  expressApplicationInstance.use(cookieParser());
  expressApplicationInstance.use(express.json({ limit: '64kb' }))
  expressApplicationInstance.use(requestIdMiddleware);
  expressApplicationInstance.use(sessionMiddleware);
  expressApplicationInstance.use(httpLoggingMiddleware)
  expressApplicationInstance.use(sessionMiddleware)
  expressApplicationInstance.use(express.urlencoded({ extended: false }))

  
  // Routes
  expressApplicationInstance.use("/api", apiRouter);
  expressApplicationInstance.get('/openapi.json', (_req, res) => res.json(openApiDocument))
  expressApplicationInstance.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))

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
