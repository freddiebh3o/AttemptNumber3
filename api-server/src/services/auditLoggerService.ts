// api-server/src/services/auditLoggerService.ts
import { Prisma, type PrismaClient, type AuditAction, type AuditEntityType } from '@prisma/client';

type Client = Prisma.TransactionClient | PrismaClient;
type Jsonish = Record<string, any> | null | undefined;

/** Very small redactor for sensitive keys. */
function redact(val: any): any {
  if (val == null || typeof val !== 'object') return val;

  if (Array.isArray(val)) return val.map(redact);

  const src = val as Record<string, any>;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(src)) {
    if (/(password|token|secret|authorization|apiKey)/i.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

/** Whitelist fields per entity type to keep snapshots tidy. */
function whitelistSnapshot(entityType: AuditEntityType, input: Jsonish) {
  if (!input || typeof input !== 'object') return input ?? null;
  const i = input as Record<string, any>;

  const pick = (keys: string[]) => {
    const out: Record<string, any> = {};
    for (const k of keys) if (k in i) out[k] = i[k];
    return redact(out);
  };

  switch (entityType) {
    case 'PRODUCT':
      return pick(['id','productName','productSku','productPricePence','entityVersion','createdAt','updatedAt','tenantId']);
    case 'STOCK_LOT':
      return pick(['id','productId','branchId','qtyReceived','qtyRemaining','unitCostPence','sourceRef','receivedAt']);
    case 'STOCK_LEDGER':
      return pick(['id','productId','branchId','lotId','kind','qtyDelta','reason','occurredAt']);
    case 'BRANCH':
      return pick(['id','branchName','branchSlug','isActive']);
    case 'PRODUCT_STOCK':
      return pick(['branchId','productId','qtyOnHand','qtyAllocated']);
    case 'USER':
      return pick(['id','userEmailAddress','createdAt','currentTenantId']);
    case 'ROLE':
      return pick(['id', 'name', 'description', 'tenantId', 'isSystem', 'permissions']);
    case 'TENANT':
      return pick(['id','tenantSlug','tenantName']);
    case 'STOCK_TRANSFER':
      return pick(['id', 'transferNumber', 'sourceBranchId', 'destinationBranchId', 'status', 'requestedByUserId', 'reviewedByUserId', 'shippedByUserId', 'requestedAt', 'reviewedAt', 'shippedAt', 'completedAt', 'requestNotes', 'reviewNotes']);
    case 'STOCK_TRANSFER_ITEM':
      return pick(['id', 'transferId', 'productId', 'qtyRequested', 'qtyApproved', 'qtyShipped', 'qtyReceived', 'avgUnitCostPence']);
    default:
      return redact(i);
  }
}

/** Minimal shallow diff on whitelisted snapshots. */
function diff(before: any, after: any) {
  if (!before && !after) return null;
  if (!before) return { added: after };
  if (!after) return { removed: before };

  const changed: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    const same =
      a instanceof Date && b instanceof Date
        ? a.getTime() === b.getTime()
        : JSON.stringify(a) === JSON.stringify(b);
    if (!same) changed[k] = { from: a, to: b };
  }
  return Object.keys(changed).length ? changed : null;
}

/** Map optional JSON → Prisma’s nullable JSON input type. */
function toNullableJsonInput(
  v: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

export async function writeAuditEvent(
  client: Client,
  params: {
    tenantId: string;
    actorUserId?: string | null;
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    entityName?: string | null;
    before?: Jsonish;
    after?: Jsonish;
    correlationId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }
) {
  const beforeJson = whitelistSnapshot(params.entityType, params.before);
  const afterJson  = whitelistSnapshot(params.entityType, params.after);
  const diffJson   = diff(beforeJson, afterJson);

  await client.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      actorUserId: params.actorUserId ?? null,

      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,

      entityName: params.entityName ?? null,

      beforeJson: toNullableJsonInput(beforeJson),
      afterJson:  toNullableJsonInput(afterJson),
      diffJson:   toNullableJsonInput(diffJson),

      correlationId: params.correlationId ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}
