// api-server/src/openapi/schemas/products.ts
import { z } from "zod";
import { ZodPageInfo } from "./stock.js";

/** ---------------- Products list ---------------- */

export const ZodProductRecord = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    productName: z.string(),
    productSku: z.string(),
    productPricePence: z.number().int(),
    barcode: z.string().nullable().optional(),
    barcodeType: z.string().nullable().optional(),
    entityVersion: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ProductRecord");

export const ZodCreateProductRequestBody = z
  .object({
    productName: z.string().min(1).max(200),
    productSku: z.string().min(1).max(100),
    productPricePence: z.number().int().min(0),
    barcode: z.string().min(1).max(100).optional(),
    barcodeType: z.enum(["EAN13", "UPCA", "CODE128", "QR"]).optional(),
  })
  .openapi("CreateProductRequestBody");

export const ZodUpdateProductParams = z
  .object({
    productId: z.string(),
  })
  .openapi("UpdateProductRouteParams");

export const ZodUpdateProductRequestBody = z
  .object({
    productName: z.string().min(1).max(200).optional(),
    productPricePence: z.number().int().min(0).optional(),
    barcode: z.string().min(1).max(100).optional().nullable(),
    barcodeType: z.enum(["EAN13", "UPCA", "CODE128", "QR"]).optional().nullable(),
    currentEntityVersion: z.number().int().min(1),
  })
  .openapi("UpdateProductRequestBody");

export const ZodListProductsQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    // filters
    q: z.string().optional(),
    minPricePence: z.number().int().min(0).optional(),
    maxPricePence: z.number().int().min(0).optional(),
    createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // sort
    sortBy: z
      .enum(["createdAt", "updatedAt", "productName", "productPricePence"])
      .optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi("ListProductsQuery");

export const ZodProductsListResponseData = z
  .object({
    items: z.array(ZodProductRecord),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().nullable().optional(),
      totalCount: z.number().int().min(0).optional(),
    }),
    applied: z.object({
      limit: z.number().int().min(1).max(100),
      sort: z.object({
        field: z.enum([
          "createdAt",
          "updatedAt",
          "productName",
          "productPricePence",
        ]),
        direction: z.enum(["asc", "desc"]),
      }),
      filters: z.object({
        q: z.string().optional(),
        minPricePence: z.number().int().min(0).optional(),
        maxPricePence: z.number().int().min(0).optional(),
        createdAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        createdAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        updatedAtFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        updatedAtTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    }),
  })
  .openapi("ProductsListResponseData");

/** ---------------- Activity (audit + ledger) ---------------- */

export const ZodProductActivityActor = z
  .object({
    userId: z.string(),
    display: z.string(),
  })
  .nullable()
  .openapi("ProductActivityActor");

export const ZodProductActivityItemAudit = z
  .object({
    kind: z.literal("audit"),
    id: z.string(),
    when: z.string().datetime(),
    action: z.string(),
    message: z.string(),
    messageParts: z.record(z.string(), z.unknown()).optional(),
    actor: ZodProductActivityActor.optional(),
    correlationId: z.string().nullable().optional(),
    entityName: z.string().nullable().optional(),
  })
  .openapi("ProductActivityItemAudit");

export const ZodProductActivityItemLedger = z
  .object({
    kind: z.literal("ledger"),
    id: z.string(),
    when: z.string().datetime(),
    entryKind: z.enum(["RECEIPT", "ADJUSTMENT", "CONSUMPTION", "REVERSAL"]),
    qtyDelta: z.number().int(),
    branchId: z.string().nullable().optional(),
    branchName: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    lotId: z.string().nullable().optional(),
    message: z.string(),
    messageParts: z.record(z.string(), z.unknown()).optional(),
    actor: ZodProductActivityActor.optional(),
    correlationId: z.string().nullable().optional(),
  })
  .openapi("ProductActivityItemLedger");

export const ZodProductActivityItem = z
  .discriminatedUnion("kind", [
    ZodProductActivityItemAudit,
    ZodProductActivityItemLedger,
  ])
  .openapi("ProductActivityItem");

export const ZodProductActivityType = z
  .enum(["all", "audit", "ledger"])
  .openapi("ProductActivityType");

export const ZodActorRef = z
  .object({ userId: z.string(), display: z.string() })
  .openapi("ActorRef");

export const ZodUnifiedActivityItem = z
  .union([
    z.object({
      kind: z.literal("audit"),
      id: z.string(),
      when: z.string().datetime(),
      action: z.string(),
      message: z.string(),
      messageParts: z.record(z.string(), z.any()).optional(),
      actor: ZodActorRef.nullable().optional(),
      correlationId: z.string().nullable().optional(),
      entityName: z.string().nullable().optional(),
    }),
    z.object({
      kind: z.literal("ledger"),
      id: z.string(),
      when: z.string().datetime(),
      entryKind: z.enum(["RECEIPT", "ADJUSTMENT", "CONSUMPTION", "REVERSAL"]),
      qtyDelta: z.number().int(),
      branchId: z.string().nullable().optional(),
      branchName: z.string().nullable().optional(),
      reason: z.string().nullable().optional(),
      lotId: z.string().nullable().optional(),
      message: z.string(),
      messageParts: z.record(z.string(), z.any()).optional(),
      actor: ZodActorRef.nullable().optional(),
      correlationId: z.string().nullable().optional(),
    }),
  ])
  .openapi("UnifiedActivityItem");

// Query for /activity
export const ZodProductActivityQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
    occurredFrom: z.string().datetime().optional(),
    occurredTo: z.string().datetime().optional(),
    type: ZodProductActivityType.optional(),
    actorIds: z
      .string()
      .optional()
      .openapi({ description: "CSV of user IDs to filter by" }),
    includeFacets: z.boolean().optional(),
    includeTotal: z.boolean().optional(), // NEW: request total count
  })
  .openapi("ProductActivityQuery");

// Extend PageInfo to include optional totalCount (for activity responses)
export const ZodPageInfoWithTotal = ZodPageInfo.extend({
  totalCount: z.number().int().min(0).optional(),
}).openapi("PageInfoWithTotal");

// Response for /activity
export const ZodProductActivityResponseData = z
  .object({
    items: z.array(ZodProductActivityItem),
    pageInfo: ZodPageInfoWithTotal, // <-- includes optional totalCount
    facets: z
      .object({
        actors: z.array(ZodActorRef),
      })
      .optional(),
  })
  .openapi("ProductActivityResponseData");

/** ---------------- Barcode Lookup ---------------- */

export const ZodBarcodeLookupParams = z
  .object({
    barcode: z.string().min(1).max(100),
  })
  .openapi("BarcodeLookupParams");

export const ZodBarcodeLookupQuery = z
  .object({
    branchId: z.string().optional(),
  })
  .openapi("BarcodeLookupQuery");

export const ZodProductWithStock = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    productName: z.string(),
    productSku: z.string(),
    productPricePence: z.number().int(),
    barcode: z.string().nullable().optional(),
    barcodeType: z.string().nullable().optional(),
    entityVersion: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    stock: z
      .object({
        branchId: z.string(),
        branchName: z.string(),
        qtyOnHand: z.number().int(),
        qtyAllocated: z.number().int(),
      })
      .nullable()
      .optional(),
  })
  .openapi("ProductWithStock");

export const ZodBarcodeLookupResponseData = z
  .object({
    product: ZodProductWithStock,
  })
  .openapi("BarcodeLookupResponseData");
