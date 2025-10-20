// api-server/src/openapi/schemas/tenants.ts
import { z } from 'zod';

export const ZodHex = z.string().regex(/^#(?:[0-9a-fA-F]{6})$/).openapi({
  description: 'Hex color in #RRGGBB',
  example: '#3b82f6',
});

export const ZodPalette10 = z.array(ZodHex).length(10).openapi({
  description: 'Mantine 10-step palette (0–9)',
  example: ['#e7f7ff','#d0eeff','#a1dcff','#6bc8ff','#41b7ff','#27aaff','#159fff','#008ff3','#007fd9','#0062a6'],
});

export const ZodThemeOverrides = z.object({
  colorScheme: z.enum(['light','dark']).optional(),
  primaryColor: z.string().optional(),
  primaryShade: z.union([
    z.number().int().min(0).max(9),
    z.object({ light: z.number().int().min(0).max(9).optional(), dark: z.number().int().min(0).max(9).optional() }),
  ]).optional(),
  colors: z.record(z.string(), ZodPalette10).optional(),
  defaultRadius: z.string().regex(/^\d+px$/).optional(),
  fontFamily: z.string().max(200).optional(),
}).strict().partial().openapi('ThemeOverrides');

export const ZodPresetKey = z.enum([
  'classicBlue','rubyDark','emeraldLight','oceanLight',
  'violetLight','grapeDark','tealDark','cyanLight',
  'orangeLight','limeLight','pinkDark','yellowLight',
]).openapi('PresetKey');

export const ZodTenantSlugParam = z.object({ tenantSlug: z.string().min(1) }).openapi('TenantSlugParam');

export const ZodTenantThemeResponseData = z.object({
  presetKey: ZodPresetKey.nullable(),
  overrides: ZodThemeOverrides.default({}),
  logoUrl: z.string().url().nullable().default(null),
  updatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime().nullable(),
}).openapi('TenantThemeResponseData');

export const ZodTenantThemePutBody = z.object({
  presetKey: ZodPresetKey.nullable().optional(),
  overrides: ZodThemeOverrides.optional(),
  logoUrl: z.string().url().max(2048).nullable().optional(),
}).strict().openapi('TenantThemePutBody');

export const ZodActorRef = z
  .object({ userId: z.string(), display: z.string() })
  .openapi('ActorRef');

export const ZodTenantThemeActivityItem = z.object({
  kind: z.literal('audit'),
  id: z.string(),
  when: z.string().datetime(),
  action: z.string(),
  message: z.string(),
  messageParts: z.record(z.string(), z.unknown()).optional(),
  actor: ZodActorRef.nullable().optional(),
  correlationId: z.string().nullable().optional(),
}).openapi('TenantThemeActivityItem');

export const ZodTenantThemeActivityQuery = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  occurredFrom: z.string().datetime().optional(),
  occurredTo: z.string().datetime().optional(),
  actorIds: z.string().optional().openapi({ description: 'CSV of user IDs to filter by' }),
  includeFacets: z.boolean().optional(),
  includeTotal: z.boolean().optional(),
}).openapi('TenantThemeActivityQuery');

// If you already have ZodPageInfoWithTotal in products, either import it or redefine:
export const ZodPageInfoWithTotal = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable().optional(),
  totalCount: z.number().int().min(0).optional(),
}).openapi('PageInfoWithTotal');

export const ZodTenantThemeActivityResponseData = z.object({
  items: z.array(ZodTenantThemeActivityItem),
  pageInfo: ZodPageInfoWithTotal,
  facets: z.object({
    actors: z.array(ZodActorRef),
  }).optional(),
}).openapi('TenantThemeActivityResponseData');

// Feature Flags schemas
export const ZodTenantFeatureFlagsPutBody = z.object({
  chatAssistantEnabled: z.boolean().optional(),
  openaiApiKey: z.string().nullable().optional(),
  barcodeScanningEnabled: z.boolean().optional(),
}).strict().openapi('TenantFeatureFlagsPutBody');

export const ZodTenantFeatureFlagsResponseData = z.object({
  chatAssistantEnabled: z.boolean().default(false),
  openaiApiKey: z.string().nullable().default(null),
  barcodeScanningEnabled: z.boolean().default(false),
}).openapi('TenantFeatureFlagsResponseData');