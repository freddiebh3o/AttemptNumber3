// admin-web/src/api/transferAnalytics.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

// OpenAPI-derived types for analytics endpoints
type OverviewMetricsResponse =
  paths["/api/stock-transfers/analytics/overview"]["get"]["responses"]["200"]["content"]["application/json"];

type VolumeChartResponse =
  paths["/api/stock-transfers/analytics/volume-chart"]["get"]["responses"]["200"]["content"]["application/json"];

type BranchDependenciesResponse =
  paths["/api/stock-transfers/analytics/branch-dependencies"]["get"]["responses"]["200"]["content"]["application/json"];

type TopRoutesResponse =
  paths["/api/stock-transfers/analytics/top-routes"]["get"]["responses"]["200"]["content"]["application/json"];

type StatusDistributionResponse =
  paths["/api/stock-transfers/analytics/status-distribution"]["get"]["responses"]["200"]["content"]["application/json"];

type BottlenecksResponse =
  paths["/api/stock-transfers/analytics/bottlenecks"]["get"]["responses"]["200"]["content"]["application/json"];

type ProductFrequencyResponse =
  paths["/api/stock-transfers/analytics/product-frequency"]["get"]["responses"]["200"]["content"]["application/json"];

// Common params interface for analytics endpoints
interface AnalyticsParams {
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  branchId?: string; // Filter by specific branch (overview only)
  limit?: number; // For top-routes and product-frequency
}

/**
 * Get overview metrics (4 key metrics for dashboard cards)
 * Endpoint: GET /api/stock-transfers/analytics/overview
 */
export async function getOverviewMetricsApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);
  if (params?.branchId) search.set("branchId", params.branchId);

  const qs = search.toString();

  return httpRequestJson<OverviewMetricsResponse>(
    `/api/stock-transfers/analytics/overview${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get volume chart data (time series for line chart)
 * Endpoint: GET /api/stock-transfers/analytics/volume-chart
 */
export async function getVolumeChartDataApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);

  const qs = search.toString();

  return httpRequestJson<VolumeChartResponse>(
    `/api/stock-transfers/analytics/volume-chart${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get branch dependencies (transfer volume between branches)
 * Endpoint: GET /api/stock-transfers/analytics/branch-dependencies
 */
export async function getBranchDependenciesApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);

  const qs = search.toString();

  return httpRequestJson<BranchDependenciesResponse>(
    `/api/stock-transfers/analytics/branch-dependencies${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get top routes (routes table with completion times)
 * Endpoint: GET /api/stock-transfers/analytics/top-routes
 */
export async function getTopRoutesApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));

  const qs = search.toString();

  return httpRequestJson<TopRoutesResponse>(
    `/api/stock-transfers/analytics/top-routes${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get status distribution (pie chart data)
 * Endpoint: GET /api/stock-transfers/analytics/status-distribution
 */
export async function getStatusDistributionApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);

  const qs = search.toString();

  return httpRequestJson<StatusDistributionResponse>(
    `/api/stock-transfers/analytics/status-distribution${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get bottlenecks (average time in each stage)
 * Endpoint: GET /api/stock-transfers/analytics/bottlenecks
 */
export async function getBottlenecksApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);

  const qs = search.toString();

  return httpRequestJson<BottlenecksResponse>(
    `/api/stock-transfers/analytics/bottlenecks${qs ? `?${qs}` : ""}`
  );
}

/**
 * Get product frequency (most transferred products)
 * Endpoint: GET /api/stock-transfers/analytics/product-frequency
 */
export async function getProductFrequencyApiRequest(params?: AnalyticsParams) {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));

  const qs = search.toString();

  return httpRequestJson<ProductFrequencyResponse>(
    `/api/stock-transfers/analytics/product-frequency${qs ? `?${qs}` : ""}`
  );
}
