// api-server/src/routes/transferAnalyticsRouter.ts
import { Router } from 'express';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { assertAuthed } from '../types/assertions.js';
import { createStandardSuccessResponse } from '../utils/standardResponse.js';
import * as analyticsService from '../services/analytics/transferAnalyticsService.js';
import { Errors } from '../utils/httpErrors.js';

export const transferAnalyticsRouter = Router();

/**
 * Parse and validate date query params
 * Defaults to last 30 days if not provided
 */
function parseDateRange(startDateStr?: string, endDateStr?: string) {
  const now = new Date();
  const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const defaultEndDate = now;

  let startDate = defaultStartDate;
  let endDate = defaultEndDate;

  if (startDateStr) {
    const parsed = new Date(startDateStr);
    if (isNaN(parsed.getTime())) {
      throw Errors.validation('Invalid startDate format. Use ISO 8601 (YYYY-MM-DD)');
    }
    startDate = parsed;
  }

  if (endDateStr) {
    const parsed = new Date(endDateStr);
    if (isNaN(parsed.getTime())) {
      throw Errors.validation('Invalid endDate format. Use ISO 8601 (YYYY-MM-DD)');
    }
    // Set to end of day
    parsed.setHours(23, 59, 59, 999);
    endDate = parsed;
  }

  if (startDate > endDate) {
    throw Errors.validation('startDate must be before endDate');
  }

  return { startDate, endDate };
}

// GET /api/stock-transfers/analytics/overview - Overview metrics
transferAnalyticsRouter.get(
  '/overview',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const branchId = req.query.branchId as string | undefined;

      const metrics = await analyticsService.getOverviewMetrics({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
        ...(branchId ? { branchId } : {}),
      });

      return res.status(200).json(createStandardSuccessResponse(metrics));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/analytics/volume-chart - Volume chart data
transferAnalyticsRouter.get(
  '/volume-chart',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const chartData = await analyticsService.getVolumeChartData({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
      });

      return res.status(200).json(createStandardSuccessResponse(chartData));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/analytics/branch-dependencies - Branch dependency graph
transferAnalyticsRouter.get(
  '/branch-dependencies',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const dependencies = await analyticsService.getBranchDependencies({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
      });

      return res.status(200).json(createStandardSuccessResponse(dependencies));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/analytics/top-routes - Top transfer routes
transferAnalyticsRouter.get(
  '/top-routes',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const limitStr = req.query.limit as string | undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;

      const routes = await analyticsService.getTopRoutes({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
        ...(limit && !isNaN(limit) ? { limit } : {}),
      });

      return res.status(200).json(createStandardSuccessResponse(routes));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/analytics/status-distribution - Status pie chart
transferAnalyticsRouter.get(
  '/status-distribution',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const distribution = await analyticsService.getStatusDistribution({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
      });

      return res.status(200).json(createStandardSuccessResponse(distribution));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/analytics/bottlenecks - Bottleneck analysis
transferAnalyticsRouter.get(
  '/bottlenecks',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const bottlenecks = await analyticsService.getBottlenecks({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
      });

      return res.status(200).json(createStandardSuccessResponse(bottlenecks));
    } catch (e) {
      return next(e);
    }
  }
);

// GET /api/stock-transfers/analytics/product-frequency - Product transfer frequency
transferAnalyticsRouter.get(
  '/product-frequency',
  requireAuthenticatedUserMiddleware,
  requirePermission('reports:view'),
  async (req, res, next) => {
    try {
      assertAuthed(req);

      const { startDate, endDate } = parseDateRange(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      const limitStr = req.query.limit as string | undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;

      const products = await analyticsService.getProductFrequency({
        tenantId: req.currentTenantId,
        startDate,
        endDate,
        ...(limit && !isNaN(limit) ? { limit } : {}),
      });

      return res.status(200).json(createStandardSuccessResponse(products));
    } catch (e) {
      return next(e);
    }
  }
);
