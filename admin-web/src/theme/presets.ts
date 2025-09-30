// admin-web/src/theme/presets.ts
import type { MantineColorsTuple } from '@mantine/core';

const ruby: MantineColorsTuple = ['#ffe9ea','#ffd2d5','#ffa7ad','#ff7a84','#ff5663','#ff3d4b','#ff2e3d','#f01e2d','#d01024','#a8071b'];
const emerald: MantineColorsTuple = ['#e9fff6','#c9ffe8','#98ffd5','#62f7bd','#35e3a3','#18c78e','#06b27f','#009970','#007f5f','#005c45'];
const ocean: MantineColorsTuple   = ['#e7f7ff','#d0eeff','#a1dcff','#6bc8ff','#41b7ff','#27aaff','#159fff','#008ff3','#007fd9','#0062a6'];

// ⬇️ Extended list of 12 presets
export type PresetKey =
  | 'classicBlue'
  | 'rubyDark'
  | 'emeraldLight'
  | 'oceanLight'
  | 'violetLight'
  | 'grapeDark'
  | 'tealDark'
  | 'cyanLight'
  | 'orangeLight'
  | 'limeLight'
  | 'pinkDark'
  | 'yellowLight';

export const THEME_PRESETS: Record<PresetKey, any> = {
  classicBlue: {
    primaryColor: 'indigo',
    colorScheme: 'light' as const,
  },
  rubyDark: {
    colors: { ruby },
    primaryColor: 'ruby',
    colorScheme: 'dark' as const,
  },
  emeraldLight: {
    colors: { emerald },
    primaryColor: 'emerald',
    colorScheme: 'light' as const,
    defaultRadius: 'lg',
  },
  oceanLight: {
    colors: { ocean },
    primaryColor: 'ocean',
    colorScheme: 'light' as const,
  },

  // ⬇️ New presets using Mantine built-in palettes
  violetLight: { primaryColor: 'violet', colorScheme: 'light' as const },
  grapeDark:   { primaryColor: 'grape',  colorScheme: 'dark'  as const },
  tealDark:    { primaryColor: 'teal',   colorScheme: 'dark'  as const },
  cyanLight:   { primaryColor: 'cyan',   colorScheme: 'light' as const },
  orangeLight: { primaryColor: 'orange', colorScheme: 'light' as const },
  limeLight:   { primaryColor: 'lime',   colorScheme: 'light' as const },
  pinkDark:    { primaryColor: 'pink',   colorScheme: 'dark'  as const },
  yellowLight: { primaryColor: 'yellow', colorScheme: 'light' as const },
};

export const PRESET_META: Record<PresetKey, { label: string; swatchKey: string }> = {
  classicBlue:  { label: 'Classic Blue', swatchKey: 'indigo' },
  rubyDark:     { label: 'Ruby Dark',    swatchKey: 'ruby' },
  emeraldLight: { label: 'Emerald',      swatchKey: 'emerald' },
  oceanLight:   { label: 'Ocean',        swatchKey: 'ocean' },

  violetLight:  { label: 'Violet',  swatchKey: 'violet' },
  grapeDark:    { label: 'Grape',   swatchKey: 'grape' },
  tealDark:     { label: 'Teal',    swatchKey: 'teal' },
  cyanLight:    { label: 'Cyan',    swatchKey: 'cyan' },
  orangeLight:  { label: 'Orange',  swatchKey: 'orange' },
  limeLight:    { label: 'Lime',    swatchKey: 'lime' },
  pinkDark:     { label: 'Pink',    swatchKey: 'pink' },
  yellowLight:  { label: 'Yellow',  swatchKey: 'yellow' },
};
