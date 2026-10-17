// Design tokens for Money Manager.
//
// Visual direction: calm, trustworthy fintech. A cool off-white canvas,
// deep "ink" text, and a single indigo brand accent used sparingly for
// primary actions and key indicators. Category colours (stored per
// category in the database) carry the remaining colour in the UI.

export const colors = {
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
} as const;

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
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  brand: {
    shadowColor: colors.brand,
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

/** Mixes a hex colour with white; `amount` 0..1 is the share of the colour. */
export function tint(hex: string | null | undefined, amount = 0.14): string {
  const fallback = colors.brand;
  const value = (hex && /^#([0-9a-f]{6})$/i.test(hex) ? hex : fallback).slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
