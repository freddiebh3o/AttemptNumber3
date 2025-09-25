// api-server/src/server.ts
import 'dotenv/config'
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const serverPortFromEnvironmentVariable: number = Number(process.env.SERVER_PORT || 4000)
const frontendDevOriginFromEnvironmentVariable: string = process.env.FRONTEND_DEV_ORIGIN || 'http://localhost:5173'

const expressApplicationInstance = express()

// Basic CORS for local dev; will refine later for prod
expressApplicationInstance.use(cors({
  origin: frontendDevOriginFromEnvironmentVariable,
  credentials: true,
}))

expressApplicationInstance.use(cookieParser())
expressApplicationInstance.use(express.json())

// Simple request id stub for now (we’ll replace with UUID in Phase 2)
expressApplicationInstance.use((request: Request, _response: Response, next: NextFunction) => {
  ;(request as any).correlationId = 'dev-correlation-id'
  next()
})

// Health endpoint with standard-ish envelope
expressApplicationInstance.get('/api/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      serviceName: 'api-server',
      healthStatus: 'HEALTHY',
    },
    error: null,
  })
})

// Version endpoint
expressApplicationInstance.get('/api/version', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      serviceName: 'api-server',
      semanticVersion: '0.0.1',
    },
    error: null,
  })
})

// Fallback 404 (keep it plain for Phase 0)
expressApplicationInstance.use((_req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    data: null,
    error: {
      errorCode: 'RESOURCE_NOT_FOUND',
      httpStatusCode: 404,
      userFacingMessage: 'The requested resource was not found.',
      developerMessage: 'No matching route.',
      correlationId: ( _req as any ).correlationId ?? null,
    }
  })
})

expressApplicationInstance.listen(serverPortFromEnvironmentVariable, () => {
  // eslint-disable-next-line no-console
  console.log(`api-server listening on http://localhost:${serverPortFromEnvironmentVariable}`)
})
