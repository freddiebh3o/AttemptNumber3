// admin-web/src/components/theme/PaletteEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Card, Stack, Group, Text, SimpleGrid, ColorInput, Button, NumberInput, Alert, Badge, Divider,
  ThemeIcon
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useThemeStore } from '../../stores/theme';
import type { MantineColorsTuple, MantineColorShade } from '@mantine/core';
import { IconInfoCircle, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

const PALETTE_KEY = 'brand';

// Friendly tips per index (guidance, not rules)
const INDEX_TIPS: Record<number, string> = {
  0: 'Lightest — subtle backgrounds',
  1: 'Very light — soft fills',
  2: 'Light — subtle accents',
  3: 'Light-mid — chips/labels',
  4: 'Mid — outlines & accents',
  5: 'Mid-strong — CTA (light)',
  6: 'Strong — default CTA (light)',
  7: 'Stronger — CTA (dark)',
  8: 'Very strong — CTA (dark)',
  9: 'Darkest — borders/ink',
};

function cleanHex(hex: string) {
  if (!hex) return '#ffffff';
  if (!hex.startsWith('#')) return `#${hex}`;
  return hex.slice(0, 7).toLowerCase(); // strip alpha if any
}

// Build a readonly 10-tuple for Mantine from a mutable array (after validation)
function toMantineTuple(arr: string[]): MantineColorsTuple {
  const t = [
    cleanHex(arr[0] ?? '#ffffff'),
    cleanHex(arr[1] ?? '#ffffff'),
    cleanHex(arr[2] ?? '#ffffff'),
    cleanHex(arr[3] ?? '#ffffff'),
    cleanHex(arr[4] ?? '#ffffff'),
    cleanHex(arr[5] ?? '#ffffff'),
    cleanHex(arr[6] ?? '#ffffff'),
    cleanHex(arr[7] ?? '#ffffff'),
    cleanHex(arr[8] ?? '#ffffff'),
    cleanHex(arr[9] ?? '#ffffff'),
  ] as const;
  return t as unknown as MantineColorsTuple;
}

// --- Contrast helpers (WCAG-ish) ---
function hexToRgb(hex: string) {
  const v = cleanHex(hex).slice(1);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return { r, g, b };
}
function srgbToLin(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function relLuma(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(hexA: string, hexB: string) {
  const L1 = relLuma(hexA);
  const L2 = relLuma(hexB);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

export default function PaletteEditor({ tenantKey }: { tenantKey: string }) {
  const theme = useMantineTheme();
  const rec = useThemeStore((s) => s.getFor(tenantKey));
  const patchOverrides = useThemeStore((s) => s.patchOverrides);

  // Start with overrides.brand if present, otherwise current primary palette
  const currentPrimary = rec.overrides.primaryColor ?? 'indigo';
  const basePaletteFromPrimary =
    theme.colors[currentPrimary] ?? theme.colors.indigo; // MantineColorsTuple (readonly)

  // initial: readonly palette -> copy to mutable array for editing
  const initial = (rec.overrides.colors?.[PALETTE_KEY] ?? basePaletteFromPrimary) as ReadonlyArray<string>;

  const [colors, setColors] = useState<string[]>(
    Array.from({ length: 10 }, (_, i) => cleanHex(initial[i] ?? '#ffffff'))
  );

  const lightShade: MantineColorShade = (
    typeof rec.overrides.primaryShade === 'number'
      ? rec.overrides.primaryShade
      : rec.overrides.primaryShade?.light
  ) ?? 6;

  const darkShade: MantineColorShade = (
    typeof rec.overrides.primaryShade === 'number'
      ? rec.overrides.primaryShade
      : rec.overrides.primaryShade?.dark
  ) ?? 8;

  // Derived: palette checks + contrast metrics
  const checks = useMemo(() => {
    const tenSteps = colors.length === 10;

    // monotonic (0 lightest → 9 darkest) means luminance should decrease
    const lumas = colors.map(relLuma);
    const monotonic = lumas.every((L, i) => (i === 0 ? true : L <= lumas[i - 1] + 1e-6));

    // Button fill shades
    const fillLight = colors[lightShade] ?? '#000000';
    const fillDark = colors[darkShade] ?? '#000000';

    // Text contrast (assume white text on filled buttons, which is common)
    const crTextLight = contrastRatio(fillLight, '#ffffff'); // light mode text on filled
    const crTextDark  = contrastRatio(fillDark,  '#ffffff'); // dark mode text on filled

    // Component/surface contrast (discoverability of a filled button on dark surface)
    const darkSurface = '#121212';
    const crSurfaceDark = contrastRatio(fillDark, darkSurface);

    // Targets (WCAG-ish)
    const okTextLight   = crTextLight  >= 4.5; // normal text 4.5:1
    const okTextDark    = crTextDark   >= 4.5;
    const okSurfaceDark = crSurfaceDark >= 3.0; // non-text UI components 3.0:1

    return {
      tenSteps,
      monotonic,
      crTextLight,
      crTextDark,
      crSurfaceDark,
      okTextLight,
      okTextDark,
      okSurfaceDark,
    };
  }, [colors, lightShade, darkShade]);

  useEffect(() => {
    // Re-seed editor when tenant or primary palette changes
    const latest = (rec.overrides.colors?.[PALETTE_KEY] ?? basePaletteFromPrimary) as ReadonlyArray<string>;
    setColors(Array.from({ length: 10 }, (_, i) => cleanHex(latest[i] ?? '#ffffff')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantKey, rec.presetKey, rec.overrides.primaryColor]);

  function setIdx(i: number, value: string) {
    setColors((prev) => {
      const copy = [...prev];
      copy[i] = cleanHex(value);
      return copy;
    });
  }

  function loadFromPrimary() {
    const source = theme.colors[currentPrimary] ?? theme.colors.indigo; // MantineColorsTuple
    setColors(Array.from({ length: 10 }, (_, i) => cleanHex(source[i] ?? '#ffffff')));
  }

  function sortByBrightness() {
    // Ensure 0 is lightest → 9 is darkest
    const next = [...colors].sort((a, b) => relLuma(b) - relLuma(a)); // higher lum first
    setColors(next);
  }

  function savePalette() {
    const nextTuple = toMantineTuple(colors);
    const existing = (rec.overrides.colors ?? {}) as Record<string, MantineColorsTuple>;
    const nextColors: Record<string, MantineColorsTuple> = { ...existing, [PALETTE_KEY]: nextTuple };
    patchOverrides(tenantKey, { colors: nextColors });
  }

  function useAsPrimary() {
    savePalette();
    patchOverrides(tenantKey, { primaryColor: PALETTE_KEY });
  }

  function deletePalette() {
    const existing = { ...(rec.overrides.colors ?? {}) } as Record<string, MantineColorsTuple>;
    delete existing[PALETTE_KEY];
    patchOverrides(tenantKey, { colors: existing });
  }

  function setShades(light: number | null, dark: number | null) {
    const clamp = (n: unknown, fallback: number) => {
      const v = typeof n === 'number' ? n : Number(n);
      return (Number.isFinite(v) ? Math.min(9, Math.max(0, v)) : fallback) as MantineColorShade;
    };
    patchOverrides(tenantKey, { primaryShade: { light: clamp(light, 6), dark: clamp(dark, 8) } });
  }

  const overallOk =
    checks.tenSteps &&
    checks.monotonic &&
    checks.okTextLight &&
    checks.okTextDark &&
    checks.okSurfaceDark;

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text fw={600}>Custom palette (“{PALETTE_KEY}”)</Text>
            <Badge variant="outline" radius="sm">{currentPrimary} → {PALETTE_KEY}</Badge>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Button size="xs" variant="default" onClick={loadFromPrimary}>
              Load from current primary
            </Button>
            <Button size="xs" variant="default" onClick={sortByBrightness} leftSection={<IconCheck size={14} />}>
              Sort by brightness
            </Button>
            <Button size="xs" variant="light" onClick={savePalette}>
              Save palette
            </Button>
            <Button size="xs" onClick={useAsPrimary}>
              Use as primary
            </Button>
            <Button size="xs" color="red" variant="outline" onClick={deletePalette}>
              Delete
            </Button>
          </Group>
        </Group>

        {/* Editors + tips */}
        <SimpleGrid cols={{ base: 2, sm: 5 }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const tip = INDEX_TIPS[i];
            const isLightPrimary = i === lightShade;
            const isDarkPrimary = i === darkShade;
            return (
              <Stack key={i} gap={6}>
                <Group justify="space-between" gap="xs">
                  <Text size="xs" fw={600}>Index {i}</Text>
                  <Group gap={4}>
                    {isLightPrimary && <Badge size="xs" variant="outline">primary (light)</Badge>}
                    {isDarkPrimary && <Badge size="xs" variant="outline">primary (dark)</Badge>}
                  </Group>
                </Group>
                <ColorInput
                  format="hex"
                  value={colors[i]}
                  onChange={(v) => setIdx(i, v)}
                  withPicker
                  swatches={[colors[i]]}
                  disallowInput={false}
                />
                <Text size="xs" c="dimmed">{tip}</Text>
              </Stack>
            );
          })}
        </SimpleGrid>

        {/* Choose primary shades */}
        <Group grow>
          <NumberInput
            label="Primary shade (light scheme)"
            min={0}
            max={9}
            value={lightShade}
            onChange={(v) => setShades(v as number, darkShade)}
          />
          <NumberInput
            label="Primary shade (dark scheme)"
            min={0}
            max={9}
            value={darkShade}
            onChange={(v) => setShades(lightShade, v as number)}
          />
        </Group>

        {/* Live preview row */}
        <Divider />
        <Group gap="sm" wrap="wrap">
          <Text fw={600}>Preview</Text>
          <Badge color={`${PALETTE_KEY}.${lightShade}`}>Filled (light)</Badge>
          <Badge variant="light" color={`${PALETTE_KEY}.${lightShade}`}>Soft (light)</Badge>
          <Badge color={`${PALETTE_KEY}.${darkShade}`}>Filled (dark)</Badge>
          <Badge variant="light" color={`${PALETTE_KEY}.${darkShade}`}>Soft (dark)</Badge>
        </Group>

        {/* Health checks with targets */}
        <Alert
          variant="light"
          color={overallOk ? 'green' : 'yellow'}
          icon={<ThemeIcon variant="light" color="blue"><IconInfoCircle size={16} /></ThemeIcon>}
        >
          <Stack gap={6}>
            <Group gap={8}>
              {checks.tenSteps ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">Palette has 10 steps (0–9)</Text>
            </Group>
            <Group gap={8}>
              {checks.monotonic ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">Steps go from light (0) → dark (9)</Text>
            </Group>

            {/* Text contrast targets */}
            <Group gap={8}>
              {checks.okTextLight ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">
                <b>Text contrast (light mode)</b> — white text on filled {PALETTE_KEY}.{lightShade} ≈ {checks.crTextLight.toFixed(2)}:1
                {'  '}(<i>target ≥ 4.5:1</i>)
              </Text>
            </Group>
            <Group gap={8}>
              {checks.okTextDark ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">
                <b>Text contrast (dark mode)</b> — white text on filled {PALETTE_KEY}.{darkShade} ≈ {checks.crTextDark.toFixed(2)}:1
                {'  '}(<i>target ≥ 4.5:1</i>)
              </Text>
            </Group>

            {/* Component/surface contrast target */}
            <Group gap={8}>
              {checks.okSurfaceDark ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">
                <b>Component vs surface (dark)</b> — filled {PALETTE_KEY}.{darkShade} on dark surface ≈ {checks.crSurfaceDark.toFixed(2)}:1
                {'  '}(<i>target ≥ 3.0:1</i>)
              </Text>
            </Group>
          </Stack>
        </Alert>

        {/* Gentle guidance */}
        <Alert variant="light">
          Keep it simple: make index <b>0</b> the lightest and <b>9</b> the darkest; pick a
          <b> mid</b> shade (≈5–6) as your light-mode accent and a <b>strong</b> one (≈7–9) for dark-mode.
          Use “Sort by brightness” if things look out of order.
          <br />
          <br />
          <Text size="sm" c="dimmed">
            <b>About “too high” contrast:</b> Accessibility guidelines only set <i>minimums</i>.
            Higher contrast is not a problem for accessibility, though very high contrast can look a bit harsh visually.
            If that happens, try a slightly lighter shade in light mode or adjust your dark-mode shade toward mid tones.
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}
