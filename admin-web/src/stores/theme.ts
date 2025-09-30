// admin-web/src/stores/theme.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MantineColorsTuple, MantineColorShade  } from "@mantine/core";
import { THEME_PRESETS, type PresetKey } from "../theme/presets";

export type ThemeOverrides = {
  // Mantine theme bits we let users tweak:
  // colorScheme is kept here for potential future use (ignored by createTheme in v7)
  colorScheme?: "light" | "dark";
  primaryColor?: string;
  colors?: Record<string, MantineColorsTuple>;
  defaultRadius?: string;
  fontFamily?: string;

  primaryShade?: MantineColorShade | { light?: MantineColorShade; dark?: MantineColorShade };
};

export type TenantThemeRecord = {
  overrides: ThemeOverrides;
  presetKey: PresetKey | null;
  logoUrl?: string | null;
};

type ThemeState = {
  records: Record<string, TenantThemeRecord>; // keyed by tenantSlug (or 'default')
  getFor: (tenantSlug: string) => TenantThemeRecord;
  patchOverrides: (tenantSlug: string, patch: Partial<ThemeOverrides>) => void;
  setPreset: (tenantSlug: string, presetKey: PresetKey | null) => void;
  setLogoUrl: (tenantSlug: string, url: string | null) => void;
  reset: (tenantSlug: string) => void;
};

const EMPTY: TenantThemeRecord = {
  overrides: {},
  presetKey: null,
  logoUrl: null,
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      records: {},
      getFor: (tenantSlug) => get().records[tenantSlug] ?? EMPTY,
      patchOverrides: (tenantSlug, patch) => {
        const rec = get().records[tenantSlug] ?? EMPTY;
        set({
          records: {
            ...get().records,
            [tenantSlug]: { ...rec, overrides: { ...rec.overrides, ...patch } },
          },
        });
      },
      setPreset: (tenantSlug, presetKey) => {
        const rec = get().records[tenantSlug] ?? EMPTY;
        // When a preset is chosen, we apply its theme values as overrides
        const preset = presetKey ? THEME_PRESETS[presetKey] : {};
        set({
          records: {
            ...get().records,
            [tenantSlug]: {
              ...rec,
              presetKey,
              overrides: { ...rec.overrides, ...preset },
            },
          },
        });
      },
      setLogoUrl: (tenantSlug, url) => {
        const rec = get().records[tenantSlug] ?? EMPTY;
        set({
          records: { ...get().records, [tenantSlug]: { ...rec, logoUrl: url } },
        });
      },
      reset: (tenantSlug) => {
        const records = { ...get().records };
        records[tenantSlug] = EMPTY;
        set({ records });
      },
    }),
    { name: "tenant-theme-v1" }
  )
);
