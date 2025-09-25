// api-server/src/server.ts
import { createConfiguredExpressApplicationInstance } from './app.js'
import { pinoLoggerInstance } from './logger/logger.js'

process.on('unhandledRejection', (reason) => {
  pinoLoggerInstance.error({ err: reason }, 'Unhandled promise rejection')
})
process.on('uncaughtException', (err) => {
  pinoLoggerInstance.fatal({ err }, 'Uncaught exception')
  process.exit(1)
})

const { expressApplicationInstance, serverPortFromEnvironmentVariable } =
  createConfiguredExpressApplicationInstance()

expressApplicationInstance.listen(serverPortFromEnvironmentVariable, () => {
  // eslint-disable-next-line no-console
  console.log(`api-server listening on http://localhost:${serverPortFromEnvironmentVariable}`)
})
