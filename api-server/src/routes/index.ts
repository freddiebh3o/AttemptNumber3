// api-server/src/routes/index.ts
import { Router } from 'express'
import { healthRouter } from './healthRouter.js'
import { authRouter } from './authRouter.js'
import { productRouter } from './productRouter.js'

export const apiRouter = Router()
apiRouter.use('/', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/products', productRouter)