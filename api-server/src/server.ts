// api-server/src/server.ts
import { createConfiguredExpressApplicationInstance } from './app.js'

const { expressApplicationInstance, serverPortFromEnvironmentVariable } =
  createConfiguredExpressApplicationInstance()

expressApplicationInstance.listen(serverPortFromEnvironmentVariable, () => {
  // eslint-disable-next-line no-console
  console.log(`api-server listening on http://localhost:${serverPortFromEnvironmentVariable}`)
})
