// api-server/src/routes/chatRouter.ts
import { Router } from 'express';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import * as chatService from '../services/chat/chatService.js';
import * as conversationService from '../services/chat/conversationService.js';
import * as analyticsService from '../services/chat/analyticsService.js';
import * as suggestionService from '../services/chat/suggestionService.js';

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

/**
 * GET /api/chat/analytics - Get analytics summary for current tenant
 *
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: today)
 */
chatRouter.get(
  '/analytics',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;

      // Default to last 30 days
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const summary = await analyticsService.getAnalyticsSummary({
        tenantId: req.currentTenantId!,
        startDate: start,
        endDate: end,
      });

      return res.json({
        success: true,
        data: summary,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/chat/suggestions - Get smart suggestions for current user
 *
 * Query params:
 * - limit: number of suggestions to return (default: 6)
 * - category: filter by category (optional)
 *
 * SECURITY:
 * - Suggestions are personalized based on user's permissions and branch memberships
 * - No specific permission required (everyone can get suggestions)
 */
chatRouter.get(
  '/suggestions',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      const { limit, category } = req.query;

      const suggestions = category
        ? await suggestionService.getSuggestionsByCategory({
            userId: req.currentUserId!,
            tenantId: req.currentTenantId!,
            category: category as any,
            limit: limit ? parseInt(limit as string, 10) : 4,
          })
        : await suggestionService.getSuggestionsForUser({
            userId: req.currentUserId!,
            tenantId: req.currentTenantId!,
            limit: limit ? parseInt(limit as string, 10) : 6,
          });

      return res.json({
        success: true,
        data: suggestions,
      });
    } catch (e) {
      next(e);
    }
  }
);
