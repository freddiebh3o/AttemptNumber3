import pino from 'pino'

const logLevelFromEnvironmentVariable = process.env.LOG_LEVEL || 'info'
const isDevelopmentEnvironment = process.env.NODE_ENV !== 'production'
const shouldUsePrettyTransport = process.env.PRETTY_LOGS !== 'false' && isDevelopmentEnvironment

// Build base options first (no undefined props)
const baseOptions: pino.LoggerOptions = {
  level: logLevelFromEnvironmentVariable,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'requestBodyValue.password',
    ],
    remove: true,
  },
  base: { serviceName: 'api-server' },
}

// Only add `transport` when enabled (avoid `undefined`)
const loggerOptions: pino.LoggerOptions = shouldUsePrettyTransport
  ? {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: false,
        },
      },
    }
  : baseOptions

export const pinoLoggerInstance = pino(loggerOptions)
