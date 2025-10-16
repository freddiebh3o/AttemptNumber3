// api-server/src/routes/chatRouter.ts
import { Router } from 'express';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import * as chatService from '../services/chat/chatService.js';

export const chatRouter = Router();

/**
 * POST /api/chat - Main chat endpoint
 *
 * SECURITY:
 * - requireAuthenticatedUserMiddleware ensures user is logged in
 * - No specific permission required (everyone can use chat)
 * - Tools check permissions internally via service functions
 * - All data filtered by user's branch memberships
 */
chatRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { messages } = req.body; // UIMessage[] from frontend

      // Validate messages array
      if (!Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: {
            errorCode: 'VALIDATION_ERROR',
            httpStatusCode: 400,
            userFacingMessage: 'Messages must be an array',
          },
        });
      }

      // Stream chat response (sets headers and pipes to response)
      await chatService.streamChatResponse({
        messages,
        userId: req.currentUserId!,
        tenantId: req.currentTenantId!,
        res,
      });
    } catch (e) {
      next(e);
    }
  }
);
