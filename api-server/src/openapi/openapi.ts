// src/openapi/openapi.ts
import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ---------- Registry (singleton) ----------
export const openApiRegistry = new OpenAPIRegistry();

// ---------- Base components ----------
openApiRegistry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  // NOTE: set to your actual cookie name from sessionMiddleware
  name: "session",
});

// Standard error payload from your middleware
export const ZodStandardErrorPayload = z
  .object({
    errorCode: z.string(),
    httpStatusCode: z.number().int(),
    userFacingMessage: z.string(),
    developerMessage: z.string().optional(),
    correlationId: z.string().nullable(),
  })
  .openapi("StandardErrorPayload");

// Envelope helpers
export const successEnvelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    error: z.null(),
  });

export const errorEnvelope = z
  .object({
    success: z.literal(false),
    data: z.null(),
    error: ZodStandardErrorPayload,
  })
  .openapi("ErrorEnvelope");

// Common responses
const response400 = {
  description: "Bad Request",
  content: { "application/json": { schema: errorEnvelope } },
};
const response401 = {
  description: "Unauthorized",
  content: { "application/json": { schema: errorEnvelope } },
};
const response403 = {
  description: "Forbidden",
  content: { "application/json": { schema: errorEnvelope } },
};
const response404 = {
  description: "Not Found",
  content: { "application/json": { schema: errorEnvelope } },
};
const response409 = {
  description: "Conflict",
  content: { "application/json": { schema: errorEnvelope } },
};
const response500 = {
  description: "Internal Error",
  content: { "application/json": { schema: errorEnvelope } },
};

// ---------- Schemas (mirrors of your API shapes) ----------

// Auth
const ZodSignInRequestBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    tenantSlug: z.string().min(1),
  })
  .openapi("SignInRequestBody");

const ZodTenantMembership = z
  .object({
    tenantSlug: z.string(),
    roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
  })
  .openapi("TenantMembership");

const ZodMeResponseData = z
  .object({
    user: z.object({
      id: z.string(),
      userEmailAddress: z.string().email(),
    }),
    tenantMemberships: z.array(ZodTenantMembership),
    currentTenant: z
      .object({
        tenantId: z.string(),
        tenantSlug: z.string(),
        roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
      })
      .nullable(),
  })
  .openapi("MeResponseData");

// Products
const ZodProductRecord = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    productName: z.string(),
    productSku: z.string(),
    productPriceCents: z.number().int(),
    entityVersion: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ProductRecord");

const ZodProductsListResponseData = z
  .object({
    products: z.array(ZodProductRecord),
    nextCursorId: z.string().optional(),
  })
  .openapi("ProductsListResponseData");

const ZodCreateProductRequestBody = z
  .object({
    productName: z.string().min(1).max(200),
    productSku: z.string().min(1).max(100),
    productPriceCents: z.number().int().min(0),
  })
  .openapi("CreateProductRequestBody");

const ZodUpdateProductParams = z
  .object({
    productId: z.string(),
  })
  .openapi("UpdateProductRouteParams");

const ZodUpdateProductRequestBody = z
  .object({
    productName: z.string().min(1).max(200).optional(),
    productPriceCents: z.number().int().min(0).optional(),
    currentEntityVersion: z.number().int().min(1),
  })
  .openapi("UpdateProductRequestBody");

const ZodIdempotencyHeaders = z
  .object({
    "Idempotency-Key": z.string().optional(),
  })
  .openapi("IdempotencyHeaders");

// ── Auth: switch-tenant
const ZodSwitchTenantRequestBody = z
  .object({
    tenantSlug: z.string().min(1),
  })
  .openapi("SwitchTenantRequestBody");

const ZodSwitchTenantResponseData = z
  .object({
    hasSwitchedTenant: z.boolean(),
  })
  .openapi("SwitchTenantResponseData");

// ── System (health/version)
const ZodHealthResponseData = z
  .object({
    serviceName: z.string(),
    healthStatus: z.enum(["HEALTHY", "UNHEALTHY"]).default("HEALTHY"),
  })
  .openapi("HealthResponseData");

const ZodVersionResponseData = z
  .object({
    serviceName: z.string(),
    semanticVersion: z.string(),
  })
  .openapi("VersionResponseData");

// ---------- Paths ----------
export function registerAllPathsInOpenApiRegistry() {
  // Auth — sign in
  openApiRegistry.registerPath({
    tags: ["Auth"],
    method: "post",
    path: "/api/auth/sign-in",
    request: {
      body: {
        content: {
          "application/json": { schema: ZodSignInRequestBody },
        },
      },
    },
    responses: {
      200: {
        description: "Signed in",
        content: {
          "application/json": {
            schema: successEnvelope(z.object({ signedIn: z.boolean() })),
          },
        },
      },
      400: response400,
      401: response401,
      500: response500,
    },
  });

  // Auth — sign out
  openApiRegistry.registerPath({
    tags: ["Auth"],
    method: "post",
    path: "/api/auth/sign-out",
    responses: {
      200: {
        description: "Signed out",
        content: {
          "application/json": {
            schema: successEnvelope(z.object({ signedOut: z.boolean() })),
          },
        },
      },
      500: response500,
    },
  });

  // Auth — me
  openApiRegistry.registerPath({
    tags: ["Auth"],
    method: "get",
    path: "/api/auth/me",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Current user",
        content: {
          "application/json": { schema: successEnvelope(ZodMeResponseData) },
        },
      },
      401: response401,
      500: response500,
    },
  });

  // Products — list
  openApiRegistry.registerPath({
    tags: ["Products"],
    method: "get",
    path: "/api/products",
    security: [{ cookieAuth: [] }],
    request: {
      query: z
        .object({
          limit: z.number().int().min(1).max(100).optional(),
          cursorId: z.string().optional(),
        })
        .openapi("ListProductsQuery"),
    },
    responses: {
      200: {
        description: "List products",
        content: {
          "application/json": {
            schema: successEnvelope(ZodProductsListResponseData),
          },
        },
      },
      401: response401,
      500: response500,
    },
  });

  // Products — create
  openApiRegistry.registerPath({
    tags: ["Products"],
    method: "post",
    path: "/api/products",
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      body: {
        content: {
          "application/json": { schema: ZodCreateProductRequestBody },
        },
      },
    },
    responses: {
      201: {
        description: "Created",
        content: {
          "application/json": {
            schema: successEnvelope(z.object({ product: ZodProductRecord })),
          },
        },
      },
      400: response400,
      401: response401,
      403: response403,
      409: response409,
      500: response500,
    },
  });

  // Products — update
  openApiRegistry.registerPath({
    tags: ["Products"],
    method: "put",
    path: "/api/products/{productId}",
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodUpdateProductParams,
      body: {
        content: {
          "application/json": { schema: ZodUpdateProductRequestBody },
        },
      },
    },
    responses: {
      200: {
        description: "Updated",
        content: {
          "application/json": {
            schema: successEnvelope(z.object({ product: ZodProductRecord })),
          },
        },
      },
      400: response400,
      401: response401,
      403: response403,
      404: response404,
      409: response409,
      500: response500,
    },
  });

  // Products — delete
  openApiRegistry.registerPath({
    tags: ["Products"],
    method: "delete",
    path: "/api/products/{productId}",
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodUpdateProductParams,
    },
    responses: {
      200: {
        description: "Deleted",
        content: {
          "application/json": {
            schema: successEnvelope(
              z.object({ hasDeletedProduct: z.boolean() })
            ),
          },
        },
      },
      401: response401,
      403: response403,
      404: response404,
      500: response500,
    },
  });

  // ── Auth — switch tenant
  openApiRegistry.registerPath({
    tags: ["Auth"],
    method: "post",
    path: "/api/auth/switch-tenant",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: ZodSwitchTenantRequestBody },
        },
      },
    },
    responses: {
      200: {
        description: "Switched current tenant for the session",
        content: {
          "application/json": {
            schema: successEnvelope(ZodSwitchTenantResponseData),
          },
        },
      },
      400: response400,
      401: response401,
      403: response403,
      500: response500,
    },
  });

  // ── System — health
  openApiRegistry.registerPath({
    tags: ["System"],
    method: "get",
    path: "/api/health",
    responses: {
      200: {
        description: "Service health",
        content: {
          "application/json": {
            schema: successEnvelope(ZodHealthResponseData),
          },
        },
      },
      500: response500,
    },
  });

  // ── System — version
  openApiRegistry.registerPath({
    tags: ["System"],
    method: "get",
    path: "/api/version",
    responses: {
      200: {
        description: "Service version",
        content: {
          "application/json": {
            schema: successEnvelope(ZodVersionResponseData),
          },
        },
      },
      500: response500,
    },
  });
}

// ---------- Build document ----------
export function buildOpenApiDocument() {
  // Register all paths before generating
  registerAllPathsInOpenApiRegistry();

  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);
  const servers = [{ url: 'http://localhost:4000' }]
  if (process.env.NODE_ENV === 'production' && process.env.API_PUBLIC_URL) {
    servers.unshift({ url: process.env.API_PUBLIC_URL })
  }

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Multi-tenant Admin API (POC)",
      version: "0.0.1",
      description:
        "Simple, multi-tenant admin API. Responses use a standard success/error envelope. Auth is cookie-based session.",
    },
    servers: [{ url: "http://localhost:4000" }],
    tags: [{ name: "Auth" }, { name: "Products" }, { name: 'System' }],
  });
}
