// admin-web/src/components/theme/PaletteEditor.tsx
import { useEffect, useState } from 'react';
import {
  Card, Stack, Group, Text, SimpleGrid, ColorInput, Button, NumberInput, Alert
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useThemeStore } from '../../stores/theme';
import type { MantineColorsTuple, MantineColorShade } from '@mantine/core';

const PALETTE_KEY = 'brand';

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
  // TypeScript: convince it this readonly tuple matches MantineColorsTuple
  return t as unknown as MantineColorsTuple;
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
    const l = Math.min(9, Math.max(0, Number.isFinite(light ?? NaN) ? Number(light) : 6)) as MantineColorShade;
    const d = Math.min(9, Math.max(0, Number.isFinite(dark ?? NaN) ? Number(dark) : 8)) as MantineColorShade;
    patchOverrides(tenantKey, { primaryShade: { light: l, dark: d } });
  }

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>Custom palette (“{PALETTE_KEY}”)</Text>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={loadFromPrimary}>
              Load from current primary
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

        <SimpleGrid cols={{ base: 2, sm: 5 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <ColorInput
              key={i}
              format="hex"
              label={`Index ${i}`}
              value={colors[i]}
              onChange={(v) => setIdx(i, v)}
              withPicker
              swatches={[colors[i]]}
              disallowInput={false}
            />
          ))}
        </SimpleGrid>

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

        <Alert variant="light">
          Mantine expects exactly 10 colors per palette (indexes 0–9). The selected <b>primaryColor</b> (e.g. “brand”)
          will use these steps, and <b>primaryShade</b> chooses which index is used by components in light/dark.
        </Alert>
      </Stack>
    </Card>
  );
}
