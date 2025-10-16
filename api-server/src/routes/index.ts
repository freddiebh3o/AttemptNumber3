// api-server/src/routes/index.ts
import { Router } from 'express'
import { healthRouter } from './healthRouter.js'
import { authRouter } from './authRouter.js'
import { productRouter } from './productRouter.js'
import { tenantUserRouter } from './tenantUserRouter.js'
import { tenantThemeRouter } from './tenantThemeRouter.js'
import { uploadRouter } from './uploadRouter.js';
import { roleRouter } from './roleRouter.js';
import { stockRouter } from './stockRouter.js';
import { branchRouter } from './branchRouter.js';
import { auditLoggerRouter } from './auditLoggerRouter.js';
import { stockTransfersRouter } from './stockTransfersRouter.js';
import { stockTransferTemplatesRouter } from './stockTransferTemplatesRouter.js';
import { transferApprovalRulesRouter } from './transferApprovalRulesRouter.js';
import { transferAnalyticsRouter } from './transferAnalyticsRouter.js';
import { chatRouter } from './chatRouter.js';

export const apiRouter = Router()
apiRouter.use('/', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/products', productRouter)
apiRouter.use('/tenant-users', tenantUserRouter)
apiRouter.use('/tenants', tenantThemeRouter)
apiRouter.use('/uploads', uploadRouter)
apiRouter.use('/', roleRouter)
apiRouter.use('/stock', stockRouter)
apiRouter.use('/branches', branchRouter)
apiRouter.use('/audit', auditLoggerRouter)
apiRouter.use('/stock-transfers', stockTransfersRouter)
apiRouter.use('/stock-transfer-templates', stockTransferTemplatesRouter)
apiRouter.use('/transfer-approval-rules', transferApprovalRulesRouter)
apiRouter.use('/stock-transfers/analytics', transferAnalyticsRouter)
apiRouter.use('/chat', chatRouter)