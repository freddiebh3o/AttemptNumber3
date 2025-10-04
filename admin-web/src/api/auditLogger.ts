// admin-web/src/api/auditLogger.ts
import { httpRequestJson } from "./http";
import type { paths } from "../types/openapi";

/**
 * OpenAPI-derived response types
 */
type ListEvents200Response =
  paths["/api/audit/events"]["get"]["responses"]["200"]["content"]["application/json"];

type GetEvent200Response =
  paths["/api/audit/events/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

type ListEntityEvents200Response =
  paths["/api/audit/entities/{entityType}/{entityId}"]["get"]["responses"]["200"]["content"]["application/json"];

/**
 * List audit events (tenant-scoped timeline)
 * Mirrors your server’s query params.
 */
export async function listAuditEventsApiRequest(params?: {
  limit?: number;                 // 1..100 (server clamps)
  cursorId?: string;              // pagination
  entityType?: string;            // AuditEntityType enum value (e.g. "PRODUCT")
  entityId?: string;
  action?: string;                // AuditAction enum value (e.g. "UPDATE")
  actorUserId?: string;
  occurredFrom?: string;          // ISO datetime
  occurredTo?: string;            // ISO datetime
  includeTotal?: boolean;         // adds totalCount in pageInfo
}) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.cursorId) qs.set("cursorId", params.cursorId);
  if (params?.entityType) qs.set("entityType", params.entityType);
  if (params?.entityId) qs.set("entityId", params.entityId);
  if (params?.action) qs.set("action", params.action);
  if (params?.actorUserId) qs.set("actorUserId", params.actorUserId);
  if (params?.occurredFrom) qs.set("occurredFrom", params.occurredFrom);
  if (params?.occurredTo) qs.set("occurredTo", params.occurredTo);
  if (params?.includeTotal) qs.set("includeTotal", "1");

  const query = qs.toString();
  return httpRequestJson<ListEvents200Response>(
    `/api/audit/events${query ? `?${query}` : ""}`
  );
}

/**
 * Fetch a single audit event by id
 */
export async function getAuditEventApiRequest(params: { id: string }) {
  return httpRequestJson<GetEvent200Response>(`/api/audit/events/${params.id}`);
}

/**
 * List audit events for a specific entity
 */
export async function listEntityAuditEventsApiRequest(params: {
  entityType: string;             // AuditEntityType enum value
  entityId: string;
  limit?: number;
  cursorId?: string;
  action?: string;                // AuditAction enum value
  actorUserId?: string;
  occurredFrom?: string;          // ISO
  occurredTo?: string;            // ISO
}) {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.cursorId) qs.set("cursorId", params.cursorId);
  if (params.action) qs.set("action", params.action);
  if (params.actorUserId) qs.set("actorUserId", params.actorUserId);
  if (params.occurredFrom) qs.set("occurredFrom", params.occurredFrom);
  if (params.occurredTo) qs.set("occurredTo", params.occurredTo);

  const query = qs.toString();
  return httpRequestJson<ListEntityEvents200Response>(
    `/api/audit/entities/${encodeURIComponent(params.entityType)}/${encodeURIComponent(
      params.entityId
    )}${query ? `?${query}` : ""}`
  );
}
