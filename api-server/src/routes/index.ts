import { Router } from 'express'
import { healthRouter } from './healthRouter.js'

export const apiRouter = Router()
apiRouter.use('/', healthRouter)

// Example placeholder that deliberately throws (to test error handling)
// apiRouter.get('/force-error', () => { throw Errors.internal('Forced test error') })
