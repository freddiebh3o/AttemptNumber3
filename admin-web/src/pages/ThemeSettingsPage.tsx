// admin-web/src/pages/ThemeSettingsPage.tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Title,
  Stack,
  Group,
  Card,
  Button,
  Select,
  ColorSwatch,
  SimpleGrid,
  TextInput,
  Image,
  Divider,
  NumberInput,
  Box,
  Text,
  Badge,
  Paper,
  useComputedColorScheme,
  useMantineTheme,
  Collapse,
} from "@mantine/core";
import type { MantineColorShade } from "@mantine/core"; // ⬅️ add
import { useThemeStore } from "../stores/theme";
import { PRESET_META, THEME_PRESETS, type PresetKey } from "../theme/presets";
import PaletteEditor from "../components/theme/PaletteEditor";

const toShade = (
  v: unknown,
  fallback: MantineColorShade
): MantineColorShade => {
  const n = typeof v === "number" ? v : Number(v);
  const clamped = Number.isFinite(n) ? Math.min(9, Math.max(0, n)) : fallback;
  return clamped as MantineColorShade;
};

export default function ThemeSettingsPage() {
  const { tenantSlug } = useParams();
  const key = tenantSlug ?? "default";

  const rec = useThemeStore((s) => s.getFor(key));
  const patchOverrides = useThemeStore((s) => s.patchOverrides);
  const setPreset = useThemeStore((s) => s.setPreset);
  const setLogoUrl = useThemeStore((s) => s.setLogoUrl);
  const reset = useThemeStore((s) => s.reset);

  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme("light");

  const [showMore, setShowMore] = useState(false);

  const PRIMARY_PRESETS: PresetKey[] = [
    "classicBlue",
    "rubyDark",
    "emeraldLight",
    "oceanLight",
  ];
  const EXTRA_PRESETS: PresetKey[] = [
    "violetLight",
    "grapeDark",
    "tealDark",
    "cyanLight",
    "orangeLight",
    "limeLight",
    "pinkDark",
    "yellowLight",
  ];

  const paletteChoices = Object.keys(theme.colors).sort();
  const currentPrimary = rec.overrides.primaryColor ?? "indigo";

  const lightShade: MantineColorShade =
    (typeof rec.overrides.primaryShade === "number"
      ? rec.overrides.primaryShade
      : rec.overrides.primaryShade?.light) ?? 6;

  const darkShade: MantineColorShade =
    (typeof rec.overrides.primaryShade === "number"
      ? rec.overrides.primaryShade
      : rec.overrides.primaryShade?.dark) ?? 8;

  const renderPresetCard = (k: PresetKey) => {
    const label = PRESET_META[k].label;
    const swatchKey = PRESET_META[k].swatchKey;
    const paletteTuple =
      (THEME_PRESETS[k]?.colors?.[swatchKey] as
        | readonly string[]
        | undefined) ??
      theme.colors[swatchKey] ??
      [];

    return (
      <Paper key={k} withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group gap={6} wrap="wrap">
            {Array.from(paletteTuple).map((c, i) => (
              <ColorSwatch key={i} color={c} size={18} />
            ))}
          </Group>
          <Group justify="space-between" align="center">
            <Text size="sm">{label}</Text>
            <Button
              size="xs"
              variant={rec.presetKey === k ? "filled" : "light"}
              onClick={() => setPreset(key, k)}
            >
              {rec.presetKey === k ? "Selected" : "Use"}
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack gap="lg">
      <Group align="center" justify="space-between">
        <Title order={2}>Theme</Title>
        <Group>
          <Button variant="default" onClick={() => reset(key)}>
            Reset to defaults
          </Button>
        </Group>
      </Group>

      {/* Presets */}
      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Presets</Text>
            {rec.presetKey ? (
              <Badge>{PRESET_META[rec.presetKey].label}</Badge>
            ) : (
              <Badge variant="light">None</Badge>
            )}
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            {PRIMARY_PRESETS.map(renderPresetCard)}
          </SimpleGrid>

          <Collapse in={showMore}>
            <Box mt="sm">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                {EXTRA_PRESETS.map(renderPresetCard)}
              </SimpleGrid>
            </Box>
          </Collapse>

          <Group justify="center" mt="xs">
            <Button variant="subtle" onClick={() => setShowMore((v) => !v)}>
              {showMore ? 'Show less' : 'View more'}
            </Button>
          </Group>
          
{/* 
          <Group>
            <Button variant="subtle" onClick={() => setPreset(key, null)}>
              Clear preset
            </Button>
          </Group> */}
        </Stack>
      </Card>

      {/* Customization */}
      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Text fw={600}>Customize</Text>
          <Group grow>
            <Select
              label="Primary color"
              data={paletteChoices}
              value={currentPrimary}
              onChange={(v) => v && patchOverrides(key, { primaryColor: v })}
              searchable
              nothingFoundMessage="No palettes"
            />
            <NumberInput
              label="Default radius (px)"
              min={0}
              max={24}
              value={
                Number((rec.overrides.defaultRadius || "").replace("px", "")) ||
                10
              }
              onChange={(v) =>
                patchOverrides(key, { defaultRadius: `${Number(v) || 0}px` })
              }
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Primary shade (light)"
              min={0}
              max={9}
              value={lightShade}
              onChange={(v) =>
                patchOverrides(key, {
                  primaryShade: { light: toShade(v, 6), dark: darkShade },
                })
              }
            />
            <NumberInput
              label="Primary shade (dark)"
              min={0}
              max={9}
              value={darkShade}
              onChange={(v) =>
                patchOverrides(key, {
                  primaryShade: { light: lightShade, dark: toShade(v, 8) },
                })
              }
            />
          </Group>

          <Divider my="xs" />

          <Stack gap="sm">
            <Text fw={600}>Logo</Text>
            <Group align="flex-end" grow>
              <TextInput
                label="Logo URL"
                placeholder="https://cdn.example.com/tenant-logo.png"
                value={rec.logoUrl ?? ""}
                onChange={(e) => setLogoUrl(key, e.currentTarget.value)}
              />
              <Button variant="light" onClick={() => setLogoUrl(key, "")}>
                Clear
              </Button>
            </Group>
            {rec.logoUrl ? (
              <Box>
                <Text size="sm" c="dimmed">
                  Preview
                </Text>
                <Image
                  src={rec.logoUrl}
                  alt="Logo preview"
                  h={40}
                  fit="contain"
                />
              </Box>
            ) : null}
          </Stack>
        </Stack>
      </Card>

      <PaletteEditor tenantKey={key} />

      <Card withBorder radius="md" p="md">
        <Stack gap="xs">
          <Text fw={600}>Notes</Text>
          <Text size="sm" c="dimmed">
            This is frontend-only for now. Your selection is stored in
            localStorage per tenant slug and applied live via a nested
            MantineProvider. The global dark-mode toggle still works (current:{" "}
            {colorScheme}).
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
