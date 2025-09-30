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
