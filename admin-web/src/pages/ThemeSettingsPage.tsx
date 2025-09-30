// admin-web/src/pages/ThemeSettingsPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
import type { MantineColorShade } from "@mantine/core";
import { useThemeStore } from "../stores/theme";
import { PRESET_META, THEME_PRESETS, type PresetKey } from "../theme/presets";
import PaletteEditor from "../components/theme/PaletteEditor";
import ShadeUsageGuide from "../components/theme/ShadeUsageGuide";
import { notifications } from "@mantine/notifications";
import { putTenantThemeApiRequest } from "../api/tenantTheme";
import type { ThemeOverrides } from "../stores/theme";
import type { paths } from "../types/openapi";
import { useDirtyStore } from "../stores/dirty";

const toShade = (v: unknown, fallback: MantineColorShade): MantineColorShade => {
  const n = typeof v === "number" ? v : Number(v);
  const clamped = Number.isFinite(n) ? Math.min(9, Math.max(0, n)) : fallback;
  return clamped as MantineColorShade;
};

type PutThemeBody = NonNullable<
  paths["/api/tenants/{tenantSlug}/theme"]["put"]["requestBody"]
>["content"]["application/json"];

// Helper: convert readonly MantineColorsTuple -> mutable string[] for API
function serializeOverridesForApi(
  overrides: ThemeOverrides
): PutThemeBody["overrides"] {
  if (!overrides) return undefined;
  const { colors, ...rest } = overrides;

  let colorsOut: Record<string, string[]> | undefined;
  if (colors) {
    colorsOut = Object.fromEntries(
      Object.entries(colors).map(([k, tuple]) => [k, Array.from(tuple)])
    );
  }

  return {
    ...rest,
    ...(colorsOut ? { colors: colorsOut } : null),
  };
}

// Stable fingerprint of what we consider the "save payload"
function getFingerprint(params: {
  presetKey: PresetKey | null;
  overrides: ThemeOverrides;
  logoUrl?: string | null;
}) {
  return JSON.stringify({
    presetKey: params.presetKey ?? null,
    overrides: serializeOverridesForApi(params.overrides) ?? {},
    logoUrl: params.logoUrl ?? null,
  });
}

export default function ThemeSettingsPage() {
  const { tenantSlug } = useParams();
  const key = tenantSlug ?? "default";

  // Local theme state (frontend store)
  const rec = useThemeStore((s) => s.getFor(key));
  const patchOverrides = useThemeStore((s) => s.patchOverrides);
  const setPreset = useThemeStore((s) => s.setPreset);
  const setLogoUrl = useThemeStore((s) => s.setLogoUrl);
  const reset = useThemeStore((s) => s.reset);

  // Global dirty store
  const { saving } = useDirtyStore();

  // UI helpers
  const theme = useMantineTheme();
  const [showMore, setShowMore] = useState(false);

  // Presets split
  const PRIMARY_PRESETS: PresetKey[] = useMemo(
    () => ["classicBlue", "rubyDark", "emeraldLight", "oceanLight"],
    []
  );
  const EXTRA_PRESETS: PresetKey[] = useMemo(
    () => [
      "violetLight",
      "grapeDark",
      "tealDark",
      "cyanLight",
      "orangeLight",
      "limeLight",
      "pinkDark",
      "yellowLight",
    ],
    []
  );

  // Current palette choices & shades
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

  // ----- Dirty tracking -----
  // Baseline is the "last saved" snapshot (or first load if none)
  const [baseline, setBaseline] = useState<string>(() =>
    getFingerprint({
      presetKey: rec.presetKey,
      overrides: rec.overrides,
      logoUrl: rec.logoUrl ?? null,
    })
  );

  // Current fingerprint vs. baseline
  const currentFingerprint = useMemo(
    () =>
      getFingerprint({
        presetKey: rec.presetKey,
        overrides: rec.overrides,
        logoUrl: rec.logoUrl ?? null,
      }),
    [rec.presetKey, rec.overrides, rec.logoUrl]
  );
  const isDirty = currentFingerprint !== baseline;

  // The actual save function (used by page button & nav guard)
  const handleSaveToServer = useCallback(async () => {
    if (!tenantSlug) {
      notifications.show({
        color: "yellow",
        title: "Theme",
        message: "Select a tenant first",
      });
      return;
    }

    const idk =
      (crypto as any)?.randomUUID?.() ??
      Math.random().toString(36).slice(2);

    const body: PutThemeBody = {
      presetKey: rec.presetKey,
      overrides: serializeOverridesForApi(rec.overrides),
      logoUrl: rec.logoUrl ?? null,
    };

    await putTenantThemeApiRequest({
      tenantSlug,
      body,
      idempotencyKeyOptional: idk,
    });

    // On success, new baseline = current
    setBaseline(getFingerprint({ presetKey: rec.presetKey, overrides: rec.overrides, logoUrl: rec.logoUrl ?? null }));

    notifications.show({
      color: "green",
      title: "Theme",
      message: "Saved theme",
    });
  }, [tenantSlug, rec.presetKey, rec.overrides, rec.logoUrl]);

  // Register dirty state + save handler with the global store
  useEffect(() => {
    useDirtyStore.setState({
      isDirty,
      reason: "You have unsaved theme changes.",
      saveHandler: async () => {
        // Let the guard control the "saving" spinner
        useDirtyStore.setState({ saving: true });
        try {
          await handleSaveToServer();
        } finally {
          useDirtyStore.setState({ saving: false });
        }
      },
    });

    // Cleanup on unmount/tenant change
    return () => {
      useDirtyStore.setState({
        isDirty: false,
        reason: null,
        saveHandler: null,
      });
    };
  }, [isDirty, handleSaveToServer]);

  // Reset baseline when tenant changes (so we don't carry dirty across tenants)
  useEffect(() => {
    setBaseline(
      getFingerprint({
        presetKey: rec.presetKey,
        overrides: rec.overrides,
        logoUrl: rec.logoUrl ?? null,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // ----- UI render helpers -----
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

  // Page-level Save button (shares the same handler as the guard)
  async function onClickSave() {
    try {
      useDirtyStore.setState({ saving: true });
      await handleSaveToServer();
    } catch (e: any) {
      notifications.show({
        color: "red",
        title: "Theme",
        message: e?.message ?? "Failed to save theme",
      });
    } finally {
      useDirtyStore.setState({ saving: false });
    }
  }

  return (
    <Stack gap="lg">
      <Group align="center" justify="space-between">
        <Title order={2}>Theme</Title>
        <Group>
          <Button variant="default" onClick={() => reset(key)}>
            Reset to defaults
          </Button>
          <Button onClick={onClickSave} loading={saving} disabled={!tenantSlug}>
            Save
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
              {showMore ? "Show less" : "View more"}
            </Button>
          </Group>
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
      <ShadeUsageGuide tenantKey={key} />
    </Stack>
  );
}
