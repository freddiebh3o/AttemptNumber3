// api-server/src/middleware/httpLoggingMiddleware.ts
import type { IncomingMessage, ServerResponse } from 'http'
import pinoHttpImport, {
  type Options as PinoHttpOptions,
  type HttpLogger,
} from 'pino-http'
import { pinoLoggerInstance } from '../logger/logger.js'
import { randomUUID } from 'node:crypto'

// pino-http default export cast to a callable (NodeNext + CJS)
const pinoHttp = pinoHttpImport as unknown as <Req extends IncomingMessage = IncomingMessage, Res extends ServerResponse = ServerResponse>(
  opts?: PinoHttpOptions<Req, Res>
) => HttpLogger<Req, Res>

// Augment the Node req shape with fields we read (present at runtime via Express)
type Req = IncomingMessage & {
  method?: string
  url?: string
  // Express adds originalUrl; our requestId middleware adds correlationId
  originalUrl?: string
  correlationId?: string
  currentUserId?: string
  currentTenantId?: string
}

type Res = ServerResponse

export const httpLoggingMiddleware: HttpLogger<Req, Res> = pinoHttp<Req, Res>({
  logger: pinoLoggerInstance,

  autoLogging: {
    ignore: (req: Req) => (req.url ?? '') === '/api/health',
  },

  serializers: {
    req(req: Req) {
      return {
        method: req.method,
        url: req.originalUrl ?? req.url,
      }
    },
    res(res: Res) {
      return {
        statusCode: res.statusCode,
      }
    },
  },

  customLogLevel(_req: Req, res: Res, err?: Error) {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },

  // Note: signature requires responseTime
  customSuccessMessage(req: Req, res: Res, responseTime: number) {
    const url = req.originalUrl ?? req.url
    return `${req.method} ${url} ${res.statusCode}`
  },

  customErrorMessage(req: Req, res: Res, error: Error) {
    const url = req.originalUrl ?? req.url
    return `${req.method} ${url} ${res.statusCode} - ${error.message}`
  },

  customProps(req: Req, _res: Res) {
    return {
      correlationId: req.correlationId ?? null,
      currentUserId: req.currentUserId ?? null,
      currentTenantId: req.currentTenantId ?? null,
    }
  },

  genReqId(req: Req, _res: Res) {
    return req.correlationId ?? randomUUID()
  },
})
