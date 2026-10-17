// Design tokens for Money Manager.
//
// Visual direction: calm, trustworthy fintech. A cool off-white canvas,
// deep "ink" text, and a single indigo brand accent used sparingly for
// primary actions and key indicators. Category colours (stored per
// category in the database) carry the remaining colour in the UI.
//
// Components get the active palette from `useTheme()` (src/design/theme).

import { getActiveScheme } from './scheme';

export const lightColors = {
  // Surfaces
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F1F6',
  surfacePressed: '#E9EBF2',

  // Text (ink at descending emphasis)
  text: '#0F1222',
  textSecondary: '#555B70',
  textTertiary: '#8B90A3',
  textDisabled: '#B9BDCB',
  textOnBrand: '#FFFFFF',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.72)',
  textOnDarkSubtle: 'rgba(255,255,255,0.52)',

  // Brand
  brand: '#4F46E5',
  brandPressed: '#4338CA',
  brandSoft: '#EEEDFD',
  brandSoftBorder: '#DCDAFB',
  heroStart: '#1E1B4B',
  heroEnd: '#4338CA',

  // Semantic
  positive: '#0E9F6E',
  positiveSoft: '#E5F6EF',
  negative: '#E5484D',
  negativeSoft: '#FDECEC',
  warning: '#D97706',
  warningSoft: '#FEF3E2',
  info: '#2563EB',
  infoSoft: '#E8F0FE',

  // Lines
  border: '#E6E8EF',
  borderStrong: '#D5D8E2',
  divider: '#EEF0F4',

  // Overlays
  scrim: 'rgba(15,18,34,0.45)',
  shadow: '#1E1B4B',
};

export type Palette = { [K in keyof typeof lightColors]: string };

// Dark: deep indigo-black canvas, raised surfaces get lighter, and accents
// are lifted a step so they keep contrast.
export const darkColors: Palette = {
  background: '#0B0D17',
  surface: '#151827',
  surfaceMuted: '#1D2135',
  surfacePressed: '#262B42',

  text: '#F2F3F8',
  textSecondary: '#AEB3C7',
  textTertiary: '#7D8299',
  textDisabled: '#4D5269',
  textOnBrand: '#FFFFFF',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.72)',
  textOnDarkSubtle: 'rgba(255,255,255,0.52)',

  brand: '#7C74FF',
  brandPressed: '#6A61F5',
  brandSoft: '#23224A',
  brandSoftBorder: '#36336F',
  heroStart: '#1A1744',
  heroEnd: '#3B34B5',

  positive: '#34D399',
  positiveSoft: '#0F2E25',
  negative: '#F87171',
  negativeSoft: '#3A1A1E',
  warning: '#FBBF24',
  warningSoft: '#3A2B0E',
  info: '#60A5FA',
  infoSoft: '#14243F',

  border: '#272B3F',
  borderStrong: '#353A55',
  divider: '#1F2336',

  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

// Type scale: five sizes, three weights. Amounts use tabular figures so
// columns of numbers line up.
export const font = {
  size: {
    hero: 36,
    title: 22,
    body: 16,
    label: 14,
    caption: 12,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

// 4-point spacing scale
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

// Soft, ink-tinted shadows
export const shadow = {
  card: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  brand: {
    shadowColor: lightColors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Palette offered when creating categories and members
export const swatches = [
  '#F97316', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6',
  '#0EA5E9', '#14B8A6', '#10B981', '#84CC16', '#EAB308', '#78716C',
] as const;

function rgb(hex: string): [number, number, number] {
  const v = hex.slice(1);
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/**
 * A soft wash of a colour for tiles and chips; `amount` 0..1 is the share
 * of the colour. Mixes with white in light mode and with the dark surface
 * (a little stronger, so it still reads) in dark mode.
 */
export function tint(hex: string | null | undefined, amount = 0.14): string {
  const dark = getActiveScheme() === 'dark';
  const fallback = dark ? darkColors.brand : lightColors.brand;
  const [r, g, b] = rgb(hex && /^#([0-9a-f]{6})$/i.test(hex) ? hex : fallback);
  const [br, bg, bb] = dark ? rgb(darkColors.surface) : [255, 255, 255];
  const share = dark ? Math.min(1, amount * 1.7) : amount;
  const mix = (c: number, base: number) => Math.round(base + (c - base) * share);
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}
