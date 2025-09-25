import { Router } from 'express'
import { createStandardSuccessResponse } from '../utils/standardResponse.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  return res.status(200).json(createStandardSuccessResponse({
    serviceName: 'api-server',
    healthStatus: 'HEALTHY',
  }))
})

healthRouter.get('/version', (_req, res) => {
  return res.status(200).json(createStandardSuccessResponse({
    serviceName: 'api-server',
    semanticVersion: '0.0.1',
  }))
})
