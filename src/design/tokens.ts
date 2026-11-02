// Design tokens for Money Manager — "Paper & Ink".
//
// Visual direction: calm and editorial. A warm paper canvas, flat white cards
// outlined by a hairline, deep ink text and a single emerald accent used only
// for primary actions, positive money and key indicators. No gradients, no
// drop shadows. Category colours live only in small icon badges and charts.
//
// Components get the active palette from `useTheme()` (src/design/theme).

import { getActiveScheme } from './scheme';

export const lightColors = {
  // Surfaces
  background: '#F6F5F1', // paper
  surface: '#FFFFFF', // card
  surfaceMuted: '#F0EEE8', // hush: tracks, neutral badges
  surfacePressed: '#E9E7E0',

  // Text (ink at descending emphasis)
  text: '#141412',
  textSecondary: '#5C5B55',
  textTertiary: '#97958D',
  textDisabled: '#C4C2BA',
  textOnBrand: '#FFFFFF',
  /** Text and icons on an ink fill (the add button, selected chips, toast). */
  textOnInk: '#FFFFFF',

  // Brand (moss)
  brand: '#0E7A5F',
  brandPressed: '#0B6650',
  brandSoft: '#E4F1EC',
  brandSoftBorder: '#C9E3D9',

  // Semantic
  positive: '#0E7A5F',
  positiveSoft: '#E4F1EC',
  negative: '#C2532F', // clay
  negativeSoft: '#FBEDE7',
  warning: '#B7791F', // amber
  warningSoft: '#FBF1DF',
  info: '#2563EB',
  infoSoft: '#E4EEFE',

  // Lines
  border: '#E8E6E0',
  borderStrong: '#D9D6CE',
  divider: '#E8E6E0',

  // Overlays
  scrim: 'rgba(20,20,18,0.45)',
  shadow: '#141412',
};

export type Palette = { [K in keyof typeof lightColors]: string };

// Dark: warm near-black paper with slightly lighter cards; the accent lifts
// to mint and carries dark text so it stays legible without glare.
export const darkColors: Palette = {
  background: '#12120F',
  surface: '#1B1B18',
  surfaceMuted: '#262621',
  surfacePressed: '#2E2E29',

  text: '#F3F2EE',
  textSecondary: '#B5B3AB',
  textTertiary: '#7E7C74',
  textDisabled: '#4A4943',
  textOnBrand: '#0A1F18',
  textOnInk: '#12120F',

  brand: '#3CC79A',
  brandPressed: '#34B089',
  brandSoft: '#16302A',
  brandSoftBorder: '#24493E',

  positive: '#3CC79A',
  positiveSoft: '#16302A',
  negative: '#F08A68',
  negativeSoft: '#3A2119',
  warning: '#E3A84A',
  warningSoft: '#352914',
  info: '#60A5FA',
  infoSoft: '#14243F',

  border: '#2A2A26',
  borderStrong: '#3A3933',
  divider: '#2A2A26',

  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

// Inter, loaded at runtime in app/_layout.tsx. Android needs one family per
// weight; Text picks the family from the weight.
export const fontFamily = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const;

// Type scale: four sizes, two weights. Amounts use tabular figures so
// columns of numbers line up.
export const font = {
  size: {
    hero: 40,
    title: 22,
    body: 16,
    label: 13,
    caption: 13,
  },
  weight: {
    regular: '400' as const,
    semibold: '600' as const,
  },
} as const;

// 4-point spacing scale (layout uses multiples of 8 where possible)
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

// The design is flat; the only lifted element is the toast.
export const shadow = {
  raised: {
    shadowColor: lightColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
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

const isHex = (hex: string | null | undefined): hex is string => !!hex && /^#([0-9a-f]{6})$/i.test(hex);

/**
 * A soft wash of a colour for badges and chips; `amount` 0..1 is the share
 * of the colour. Mixes with white in light mode and with the dark card in
 * dark mode.
 */
export function tint(hex: string | null | undefined, amount = 0.14): string {
  const dark = getActiveScheme() === 'dark';
  const [r, g, b] = rgb(isHex(hex) ? hex : dark ? darkColors.brand : lightColors.brand);
  const [br, bg, bb] = dark ? rgb(darkColors.surface) : [255, 255, 255];
  const share = dark ? Math.min(1, amount * 1.15) : amount;
  const mix = (c: number, base: number) => Math.round(base + (c - base) * share);
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * The colour to draw an icon or initials in on top of `tint(hex)`: darkened
 * in light mode and lifted in dark mode until it reads clearly.
 */
export function inkOf(hex: string | null | undefined): string {
  const dark = getActiveScheme() === 'dark';
  const base = rgb(isHex(hex) ? hex : dark ? darkColors.textSecondary : lightColors.textSecondary);
  const target: [number, number, number] = dark ? [255, 255, 255] : [0, 0, 0];
  let c = base;
  for (let step = 0; step < 6; step++) {
    const l = luminance(c);
    if (dark ? l >= 0.3 : l <= 0.22) break;
    c = c.map((v, i) => v + (target[i] - v) * 0.15) as [number, number, number];
  }
  return `rgb(${c.map(Math.round).join(', ')})`;
}
