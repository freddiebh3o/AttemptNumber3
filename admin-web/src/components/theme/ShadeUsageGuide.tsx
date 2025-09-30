// admin-web/src/components/theme/ShadeUsageGuide.tsx
import {
    Card,
    Stack,
    Group,
    Text,
    SimpleGrid,
    ColorSwatch,
    Badge,
    useMantineTheme,
    useComputedColorScheme,
    Divider,
  } from '@mantine/core';
  import { useThemeStore } from '../../stores/theme';
  
  export default function ShadeUsageGuide({ tenantKey }: { tenantKey: string }) {
    const theme = useMantineTheme();
    const scheme = useComputedColorScheme('light');
    const rec = useThemeStore((s) => s.getFor(tenantKey));
  
    // The palette being customized/used as primary
    const primaryKey = rec.overrides.primaryColor ?? 'indigo';
    const palette = theme.colors[primaryKey] ?? theme.colors.indigo;
  
    // Which shade powers most “main accents” (e.g., primary buttons) in this mode
    const shade =
      typeof rec.overrides.primaryShade === 'number'
        ? rec.overrides.primaryShade
        : scheme === 'dark'
        ? (rec.overrides.primaryShade?.dark ?? 8)
        : (rec.overrides.primaryShade?.light ?? 6);
  
    return (
      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text fw={600}>How your shades are used</Text>
            <Badge variant="outline" radius="sm">
              Current mode: {scheme} — Main accent: {primaryKey}.{shade}
            </Badge>
          </Group>
  
          <Text size="sm" c="dimmed">
            Each color has 10 shades from <b>0 (lightest)</b> to <b>9 (darkest)</b>.
            We use the shade shown above for most main accents (like filled buttons) in the current mode.
            Lighter shades are used for soft backgrounds and subtle highlights; darker shades for stronger accents and borders.
          </Text>
  
          {/* Live preview for each shade */}
          <SimpleGrid cols={{ base: 2, sm: 5, md: 10 }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const col = palette?.[i] ?? '#ccc';
              const isPrimary = i === shade;
              return (
                <Stack key={i} gap={6} align="center">
                  <ColorSwatch color={col} size={26} />
                  <Text size="xs" c="dimmed">
                    {primaryKey}.{i}
                  </Text>
                  <Group gap={4}>
                    <Badge size="xs" color={`${primaryKey}.${i}`}>Filled</Badge>
                    <Badge size="xs" variant="light" color={`${primaryKey}.${i}`}>Soft</Badge>
                  </Group>
                  {isPrimary && <Badge size="xs" variant="outline">Main accent</Badge>}
                </Stack>
              );
            })}
          </SimpleGrid>
  
          <Divider />
  
          {/* Plain-language guidance */}
          <Stack gap={4}>
            <Text size="sm">
              <Badge size="xs" mr={6}>0-2</Badge>
              Best for soft backgrounds and subtle highlights.
            </Text>
            <Text size="sm">
              <Badge size="xs" mr={6}>3-5</Badge>
              Good for chips, tags, and light accents.
            </Text>
            <Text size="sm">
              <Badge size="xs" mr={6}>6-8</Badge>
              Ideal for main buttons and strong highlights.
            </Text>
            <Text size="sm">
              <Badge size="xs" mr={6}>9</Badge>
              Strongest shade — use sparingly for borders or very bold accents.
            </Text>
          </Stack>
        </Stack>
      </Card>
    );
  }
  