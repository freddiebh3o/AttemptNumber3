// api-server/src/openapi/openapi.ts
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

const ZodRateLimitHeaders = z.object({
  "X-RateLimit-Limit": z.string().openapi({ example: "300" }),
  "X-RateLimit-Remaining": z.string().openapi({ example: "299" }),
  "X-RateLimit-Reset": z.string().openapi({ example: "1758912000" }), // unix seconds
  "Retry-After": z.string().openapi({ example: "42" }), // seconds
});

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
const response429 = {
  description: "Too Many Requests",
  headers: ZodRateLimitHeaders,
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
          "productPriceCents",
        ]),
        direction: z.enum(["asc", "desc"]),
      }),
      filters: z.object({
        q: z.string().optional(),
        minPriceCents: z.number().int().min(0).optional(),
        maxPriceCents: z.number().int().min(0).optional(),
        createdAtFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        createdAtTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        updatedAtFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        updatedAtTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    }),
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

// Tenant users
const ZodTenantUserRecord = z
  .object({
    userId: z.string(),
    userEmailAddress: z.string().email(),
    roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .openapi("TenantUserRecord");

const ZodTenantUsersList = z
  .object({
    users: z.array(ZodTenantUserRecord),
    nextCursorId: z.string().optional(),
  })
  .openapi("TenantUsersList");

const ZodListTenantUsersQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    // filters
    q: z.string().optional(),
    roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]).optional(),
    createdAtFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    createdAtTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    updatedAtFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    updatedAtTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    // sort
    sortBy: z
      .enum(["createdAt", "updatedAt", "userEmailAddress", "roleName"])
      .optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi("ListTenantUsersQuery");

const ZodTenantUsersListResponseData = z
  .object({
    items: z.array(
      z.object({
        userId: z.string(),
        userEmailAddress: z.string().email(),
        roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
    ),
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
          "userEmailAddress",
          "roleName",
        ]),
        direction: z.enum(["asc", "desc"]),
      }),
      filters: z.object({
        q: z.string().optional(),
        roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]).optional(),
        createdAtFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        createdAtTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        updatedAtFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        updatedAtTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    }),
  })
  .openapi("TenantUsersListResponseData");

const ZodCreateTenantUserBody = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
  })
  .openapi("CreateTenantUserBody");

const ZodUpdateTenantUserBody = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    roleName: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]).optional(),
  })
  .openapi("UpdateTenantUserBody");

const ZodTenantUserEnvelope = z.object({
  user: ZodTenantUserRecord,
});

// ---------- Products list query schema ----------
const ZodListProductsQuery = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursorId: z.string().optional(),
    // filters
    q: z.string().optional(),
    minPriceCents: z.number().int().min(0).optional(),
    maxPriceCents: z.number().int().min(0).optional(),
    createdAtFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    createdAtTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    updatedAtFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    updatedAtTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    // sort
    sortBy: z
      .enum(["createdAt", "updatedAt", "productName", "productPriceCents"])
      .optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    includeTotal: z.boolean().optional(),
  })
  .openapi("ListProductsQuery");

// ── Theme / Branding (Tenants)
const ZodHex = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{6})$/)
  .openapi({
    description: "Hex color in #RRGGBB",
    example: "#3b82f6",
  });

const ZodPalette10 = z
  .array(ZodHex)
  .length(10)
  .openapi({
    description: "Mantine 10-step palette (indexes 0–9)",
    example: [
      "#e7f7ff",
      "#d0eeff",
      "#a1dcff",
      "#6bc8ff",
      "#41b7ff",
      "#27aaff",
      "#159fff",
      "#008ff3",
      "#007fd9",
      "#0062a6",
    ],
  });

const ZodThemeOverrides = z
  .object({
    // Note: colorScheme is not read by Mantine v7 theme object (kept for future)
    colorScheme: z.enum(["light", "dark"]).optional(),
    primaryColor: z.string().optional(),
    primaryShade: z
      .union([
        z.number().int().min(0).max(9),
        z.object({
          light: z.number().int().min(0).max(9).optional(),
          dark: z.number().int().min(0).max(9).optional(),
        }),
      ])
      .optional(),
    colors: z.record(z.string(), ZodPalette10).optional(), // { [name]: string[10] }
    defaultRadius: z
      .string()
      .regex(/^\d+px$/)
      .optional(),
    fontFamily: z.string().max(200).optional(),
  })
  .strict()
  .partial()
  .openapi("ThemeOverrides");

const ZodPresetKey = z
  .enum([
    "classicBlue",
    "rubyDark",
    "emeraldLight",
    "oceanLight",
    "violetLight",
    "grapeDark",
    "tealDark",
    "cyanLight",
    "orangeLight",
    "limeLight",
    "pinkDark",
    "yellowLight",
  ])
  .openapi("PresetKey");

const ZodTenantSlugParam = z
  .object({ tenantSlug: z.string().min(1) })
  .openapi("TenantSlugParam");

const ZodTenantThemeResponseData = z
  .object({
    presetKey: ZodPresetKey.nullable(),
    overrides: ZodThemeOverrides.default({}),
    logoUrl: z.string().url().nullable().default(null),
    updatedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime().nullable(),
  })
  .openapi("TenantThemeResponseData");

const ZodTenantThemePutBody = z
  .object({
    presetKey: ZodPresetKey.nullable().optional(),
    overrides: ZodThemeOverrides.optional(),
    logoUrl: z.string().url().max(2048).nullable().optional(),
  })
  .strict()
  .openapi("TenantThemePutBody");

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
      429: response429,
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
      query: ZodListProductsQuery,
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
      429: response429,
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
      429: response429,
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
      429: response429,
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
      429: response429,
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

  // GET /api/tenant-users
  openApiRegistry.registerPath({
    tags: ["TenantUsers"],
    method: "get",
    path: "/api/tenant-users",
    security: [{ cookieAuth: [] }],
    request: { query: ZodListTenantUsersQuery },
    responses: {
      200: {
        description: "List tenant users",
        content: {
          "application/json": {
            schema: successEnvelope(ZodTenantUsersListResponseData),
          },
        },
      },
      401: response401,
      403: response403,
      429: response429,
      500: response500,
    },
  });

  // POST /api/tenant-users
  openApiRegistry.registerPath({
    tags: ["TenantUsers"],
    method: "post",
    path: "/api/tenant-users",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: ZodCreateTenantUserBody } },
      },
    },
    responses: {
      201: {
        description: "Created/attached user",
        content: {
          "application/json": {
            schema: successEnvelope(ZodTenantUserEnvelope),
          },
        },
      },
      400: response400,
      401: response401,
      403: response403,
      409: response409,
      429: response429,
      500: response500,
    },
  });

  // PUT /api/tenant-users/{userId}
  openApiRegistry.registerPath({
    tags: ["TenantUsers"],
    method: "put",
    path: "/api/tenant-users/{userId}",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ userId: z.string() }),
      body: {
        content: { "application/json": { schema: ZodUpdateTenantUserBody } },
      },
    },
    responses: {
      200: {
        description: "Updated user/membership",
        content: {
          "application/json": {
            schema: successEnvelope(ZodTenantUserEnvelope),
          },
        },
      },
      400: response400,
      401: response401,
      403: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: errorEnvelope,
            examples: {
              CANT_DEMOTE_LAST_OWNER: {
                summary: "Cannot demote the last OWNER",
                value: {
                  success: false,
                  data: null,
                  error: {
                    errorCode: "CANT_DEMOTE_LAST_OWNER",
                    httpStatusCode: 403,
                    userFacingMessage:
                      "You cannot demote the last owner of a tenant.",
                    developerMessage:
                      "Refuse demotion if tenant would have zero OWNERs.",
                    correlationId: "example-correlation-id",
                  },
                },
              },
            },
          },
        },
      },
      404: response404,
      409: response409,
      429: response429,
      500: response500,
    },
  });

  // DELETE /api/tenant-users/{userId}
  openApiRegistry.registerPath({
    tags: ["TenantUsers"],
    method: "delete",
    path: "/api/tenant-users/{userId}",
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ userId: z.string() }) },
    responses: {
      200: {
        description: "Removed membership",
        content: {
          "application/json": {
            schema: successEnvelope(
              z.object({ hasRemovedMembership: z.boolean() })
            ),
          },
        },
      },
      401: response401,
      403: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: errorEnvelope,
            examples: {
              CANT_DELETE_LAST_OWNER: {
                summary: "Cannot remove the last OWNER",
                value: {
                  success: false,
                  data: null,
                  error: {
                    errorCode: "CANT_DELETE_LAST_OWNER",
                    httpStatusCode: 403,
                    userFacingMessage:
                      "You cannot delete the last owner of a tenant.",
                    developerMessage:
                      "Refuse delete if tenant would have zero OWNERs.",
                    correlationId: "example-correlation-id",
                  },
                },
              },
            },
          },
        },
      },
      404: response404,
      429: response429,
      500: response500,
    },
  });

  // ── Tenants — get theme
  openApiRegistry.registerPath({
    tags: ["Tenants"],
    method: "get",
    path: "/api/tenants/{tenantSlug}/theme",
    security: [{ cookieAuth: [] }],
    request: { params: ZodTenantSlugParam },
    responses: {
      200: {
        description: "Tenant theme (preset, overrides, logo)",
        content: {
          "application/json": {
            schema: successEnvelope(ZodTenantThemeResponseData),
          },
        },
      },
      401: response401,
      403: response403,
      404: response404,
      429: response429,
      500: response500,
    },
  });

  // ── Tenants — save theme
  openApiRegistry.registerPath({
    tags: ["Tenants"],
    method: "put",
    path: "/api/tenants/{tenantSlug}/theme",
    security: [{ cookieAuth: [] }],
    request: {
      headers: ZodIdempotencyHeaders,
      params: ZodTenantSlugParam,
      body: {
        content: {
          "application/json": { schema: ZodTenantThemePutBody },
        },
      },
    },
    responses: {
      200: {
        description: "Saved tenant theme",
        content: {
          "application/json": {
            schema: successEnvelope(ZodTenantThemeResponseData),
          },
        },
      },
      400: response400,
      401: response401,
      403: response403,
      404: response404,
      429: response429,
      500: response500,
    },
  });
}

// ---------- Build document ----------
export function buildOpenApiDocument() {
  // Register all paths before generating
  registerAllPathsInOpenApiRegistry();

  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);

  const servers = [{ url: "http://localhost:4000" }];
  if (process.env.NODE_ENV === "production" && process.env.API_PUBLIC_URL) {
    servers.unshift({ url: process.env.API_PUBLIC_URL });
  }

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Multi-tenant Admin API (POC)",
      version: "0.0.1",
      description:
        "Simple, multi-tenant admin API. Responses use a standard success/error envelope. Auth is cookie-based session.",
    },
    servers,
    tags: [
      { name: "Auth" },
      { name: "Products" },
      { name: "System" },
      { name: "TenantUsers" },
      { name: 'Tenants' }, 
    ],
  });
}
