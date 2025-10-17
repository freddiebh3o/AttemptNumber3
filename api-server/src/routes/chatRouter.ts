// api-server/src/routes/chatRouter.ts
import { Router } from 'express';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import * as chatService from '../services/chat/chatService.js';
import * as conversationService from '../services/chat/conversationService.js';

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
      const { messages, conversationId } = req.body; // UIMessage[] from frontend + optional conversationId

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
        conversationId, // Optional: resume existing conversation
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/chat/conversations - List all conversations for current user
 */
chatRouter.get(
  '/conversations',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { limit } = req.query;

      const conversations = await conversationService.listConversations({
        userId: req.currentUserId!,
        tenantId: req.currentTenantId!,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      return res.json({
        success: true,
        data: conversations,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/chat/conversations/:conversationId - Get conversation by ID with messages
 */
chatRouter.get(
  '/conversations/:conversationId',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;

      const conversation = await conversationService.getConversation({
        conversationId,
        userId: req.currentUserId!,
        tenantId: req.currentTenantId!,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: {
            errorCode: 'NOT_FOUND',
            httpStatusCode: 404,
            userFacingMessage: 'Conversation not found',
          },
        });
      }

      return res.json({
        success: true,
        data: conversation,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /api/chat/conversations/:conversationId - Delete conversation
 */
chatRouter.delete(
  '/conversations/:conversationId',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;

      await conversationService.deleteConversation({
        conversationId,
        userId: req.currentUserId!,
        tenantId: req.currentTenantId!,
      });

      return res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PATCH /api/chat/conversations/:conversationId - Update conversation title
 */
chatRouter.patch(
  '/conversations/:conversationId',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            errorCode: 'VALIDATION_ERROR',
            httpStatusCode: 400,
            userFacingMessage: 'Title is required and must be a string',
          },
        });
      }

      const updated = await conversationService.updateConversationTitle({
        conversationId,
        userId: req.currentUserId!,
        tenantId: req.currentTenantId!,
        title,
      });

      return res.json({
        success: true,
        data: updated,
      });
    } catch (e) {
      next(e);
    }
  }
);
