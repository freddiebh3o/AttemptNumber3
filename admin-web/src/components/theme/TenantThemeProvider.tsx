// admin-web/src/components/theme/TenantThemeProvider.tsx
import { MantineProvider, createTheme, mergeThemeOverrides } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { baseTheme } from '../../theme/baseTheme';
import { THEME_PRESETS } from '../../theme/presets';
import { useThemeStore } from '../../stores/theme';

export default function TenantThemeProvider({ children }: { children: ReactNode }) {
  const { tenantSlug } = useParams();
  const key = tenantSlug ?? 'default';

  const { overrides, presetKey } = useThemeStore((s) => s.getFor(key));
  const preset = presetKey ? THEME_PRESETS[presetKey] : {};

  const merged = useMemo(() => {
    // Merge base + preset + user overrides, then normalize via createTheme
    const combined = mergeThemeOverrides(baseTheme, preset, overrides);
    return createTheme(combined);
  }, [presetKey, overrides]);

  return (
    <MantineProvider theme={merged}>
      {children}
    </MantineProvider>
  );
}
