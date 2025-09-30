// admin-web/src/components/theme/TenantThemeProvider.tsx
import { MantineProvider, createTheme, mergeThemeOverrides } from '@mantine/core';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { baseTheme } from '../../theme/baseTheme';
import { THEME_PRESETS } from '../../theme/presets';
import { useThemeStore } from '../../stores/theme';
import { getTenantThemeApiRequest } from '../../api/tenantTheme';
import { notifications } from '@mantine/notifications';

export default function TenantThemeProvider({ children }: { children: ReactNode }) {
  const { tenantSlug } = useParams();
  const key = tenantSlug ?? 'default';

  const rec = useThemeStore((s) => s.getFor(key));
  const setFromServer = useThemeStore((s) => s.setFromServer);

  // Hydrate from server when tenant changes
  useEffect(() => {
    if (!tenantSlug) return; // keep 'default' tenant purely local
    (async () => {
      try {
        const res = await getTenantThemeApiRequest(tenantSlug);
        // res.data = { presetKey, overrides, logoUrl, ... }
        setFromServer(key, {
          presetKey: res.data.presetKey as any,
          overrides: (res.data.overrides ?? {}) as any,
          logoUrl: res.data.logoUrl ?? null,
          updatedAt: res.data.updatedAt ?? null,
        });
      } catch (e: any) {
        // Non-fatal: fall back to local defaults
        notifications.show({
          color: 'red',
          title: 'Theme',
          message: e?.message ?? 'Failed to load theme',
        });
      }
    })();
  }, [tenantSlug, key, setFromServer]);

  const preset = rec.presetKey ? THEME_PRESETS[rec.presetKey] : {};
  const merged = useMemo(() => {
    const combined = mergeThemeOverrides(baseTheme, preset, rec.overrides);
    return createTheme(combined);
  }, [rec.presetKey, rec.overrides]);

  return <MantineProvider theme={merged}>{children}</MantineProvider>;
}
