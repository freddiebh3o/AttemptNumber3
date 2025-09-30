// admin-web/src/components/theme/PaletteEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Card, Stack, Group, Text, SimpleGrid, ColorInput, Button, NumberInput, Alert, Badge, Divider,
  ThemeIcon, Grid
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useThemeStore } from '../../stores/theme';
import type { MantineColorsTuple, MantineColorShade } from '@mantine/core';
import { IconInfoCircle, IconCheck, IconAlertTriangle, IconWand } from '@tabler/icons-react';

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

// --- Tiny color helpers (HEX ↔ HSL) ---
function hexToRgb(hex: string) {
  const v = cleanHex(hex).slice(1);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return { r, g, b };
}
function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(Math.round(r))}${to(Math.round(g))}${to(Math.round(b))}`;
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const Hp = (h % 360) / 60;
  const X = C * (1 - Math.abs((Hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= Hp && Hp < 1) [r1, g1, b1] = [C, X, 0];
  else if (1 <= Hp && Hp < 2) [r1, g1, b1] = [X, C, 0];
  else if (2 <= Hp && Hp < 3) [r1, g1, b1] = [0, C, X];
  else if (3 <= Hp && Hp < 4) [r1, g1, b1] = [0, X, C];
  else if (4 <= Hp && Hp < 5) [r1, g1, b1] = [X, 0, C];
  else if (5 <= Hp && Hp < 6) [r1, g1, b1] = [C, 0, X];
  const m = l - C / 2;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}
function hslToHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// --- Contrast helpers (WCAG-ish) ---
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

// Generate a 10-step palette from a single base color using a simple HSL curve
function generatePaletteFromBaseHex(baseHex: string): string[] {
  const safe = cleanHex(baseHex);
  const { r, g, b } = hexToRgb(safe);
  const { h, s } = rgbToHsl(r, g, b);

  // Lightness curve: light → dark (tweakable)
  const L: number[] = [0.98, 0.96, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.32, 0.24];
  // Saturation ramp: desaturate tints, max near mid/dark (scaled by base saturation)
  const SAT_SCALE: number[] = [0.30, 0.35, 0.45, 0.60, 0.75, 0.90, 1.00, 1.00, 1.00, 1.00];

  return Array.from({ length: 10 }, (_, i) => {
    const si = Math.min(0.98, Math.max(0.05, s * SAT_SCALE[i]));
    const li = L[i];
    return hslToHex(h, si, li);
  });
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

  // Base color for generator (seed with mid step)
  const [baseHex, setBaseHex] = useState<string>(colors[6] ?? '#3366ff');

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

  // Derived: palette checks
  const checks = useMemo(() => {
    const tenSteps = colors.length === 10;
    // monotonic (0 lightest → 9 darkest) means luminance should decrease
    const lumas = colors.map(relLuma);
    const monotonic = lumas.every((L, i) => (i === 0 ? true : L <= lumas[i - 1] + 1e-6));
    // contrast targets for previews (text on filled button)
    const filledLight = colors[lightShade] ?? '#000000';
    const filledDark = colors[darkShade] ?? '#000000';
    const crOnWhite = contrastRatio(filledLight, '#ffffff'); // light scheme buttons on light surface
    const crOnDark = contrastRatio(filledDark, '#121212');   // dark scheme buttons on dark surface
    return { tenSteps, monotonic, crOnWhite, crOnDark };
  }, [colors, lightShade, darkShade]);

  useEffect(() => {
    // Re-seed editor when tenant or primary palette changes
    const latest = (rec.overrides.colors?.[PALETTE_KEY] ?? basePaletteFromPrimary) as ReadonlyArray<string>;
    const next = Array.from({ length: 10 }, (_, i) => cleanHex(latest[i] ?? '#ffffff'));
    setColors(next);
    // also re-seed generator input with mid tone
    setBaseHex(next[6] ?? '#3366ff');
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
    setBaseHex(cleanHex(source[6] ?? '#3366ff'));
  }

  function generateFromBase() {
    const next = generatePaletteFromBaseHex(baseHex);
    setColors(next);
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

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs" align="center">
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

        <Grid gutter="xs">
          {/* Base color + generate */}
          <Grid.Col span={12} >
            <ColorInput
              size="xs"
              w={150}
              label="Base color"
              withPicker
              format="hex"
              value={baseHex}
              onChange={setBaseHex}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconWand size={14} />}
              onClick={generateFromBase}
            >
              Generate from base
            </Button>
          </Grid.Col>
        </Grid>

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
          <Badge color={`${PALETTE_KEY}.${lightShade}`}>filled (light)</Badge>
          <Badge variant="light" color={`${PALETTE_KEY}.${lightShade}`}>light (light)</Badge>
          <Badge variant="outline" color={`${PALETTE_KEY}.${lightShade}`}>outline (light)</Badge>
          <Badge color={`${PALETTE_KEY}.${darkShade}`}>filled (dark)</Badge>
          <Badge variant="light" color={`${PALETTE_KEY}.${darkShade}`}>light (dark)</Badge>
          <Badge variant="outline" color={`${PALETTE_KEY}.${darkShade}`}>outline (dark)</Badge>
        </Group>

        {/* Health checks */}
        <Alert
          variant="light"
          color={(checks.tenSteps && checks.monotonic && checks.crOnWhite >= 4.5 && checks.crOnDark >= 4.5) ? 'green' : 'yellow'}
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
            <Group gap={8}>
              {(checks.crOnWhite >= 4.5) ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">
                Contrast for <b>light</b> primary ({PALETTE_KEY}.{lightShade}) on light surfaces ≈ {checks.crOnWhite.toFixed(2)}:1
                {' '}<Badge size="xs" variant="outline">target ≥ 4.5:1</Badge>
                {checks.crOnWhite < 4.5 ? ' — consider a darker index' : ''}
              </Text>
            </Group>
            <Group gap={8}>
              {(checks.crOnDark >= 4.5) ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
              <Text size="sm">
                Contrast for <b>dark</b> primary ({PALETTE_KEY}.{darkShade}) on dark surfaces ≈ {checks.crOnDark.toFixed(2)}:1
                {' '}<Badge size="xs" variant="outline">target ≥ 4.5:1</Badge>
                {checks.crOnDark < 4.5 ? ' — consider a lighter/stronger index' : ''}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Higher contrast (e.g. 7:1–10:1) is still accessible — it will just feel bolder. Aim for at least 4.5:1 and adjust taste from there.
            </Text>
          </Stack>
        </Alert>

        {/* Gentle guidance */}
        <Alert variant="light">
          Keep it simple: make index <b>0</b> the lightest and <b>9</b> the darkest, pick a
          <b> mid</b> shade (≈5–6) as your light-mode accent and a <b>strong</b> one (≈7–9) for dark-mode.
          Use “Generate from base” to get a good starting point, then “Sort by brightness” if things look out of order.
        </Alert>
      </Stack>
    </Card>
  );
}
