// Design Tokens - Apple/Linear inspired design system for Money Manager
// Refined for premium, minimal, professional Android app experience

// Color Palette - Apple/Linear inspired
export const colors = {
  // Primary surfaces - Light mode
  background: '#fafafa',
  backgroundAlt: '#f5f5f7',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceHover: '#f5f5f5',
  backgroundDark: '#0a0a0b',
  backgroundAltDark: '#111113',
  surfaceDark: '#161618',
  surfaceElevatedDark: '#1c1c1f',
  surfaceHoverDark: '#222226',
  textPrimary: '#0d0d0e',
  textSecondary: '#555558',
  textTertiary: '#8e8e93',
  textQuaternary: '#bdbdbd',
  textOnAccent: '#ffffff',
  textOnDark: '#f5f5f7',
  textOnDarkSecondary: '#a1a1a6',
  textOnDarkTertiary: '#6e6e73',
  textOnDarkQuaternary: '#48484a',
  accent: '#0066cc',
  accentHover: '#0052a3',
  accentActive: '#004080',
  accentLight: '#e8f0fe',
  accentLightDark: '#1a2a4a',
  accentIndigo: '#5e6ad2',
  accentIndigoHover: '#7170ff',
  linkOnLight: '#0066cc',
  linkOnDark: '#6fa3ff',
  success: '#1e7e34',
  successBackground: 'rgba(30, 126, 52, 0.12)',
  successBorder: 'rgba(30, 126, 52, 0.3)',
  warning: '#b06000',
  warningBackground: 'rgba(176, 96, 0, 0.12)',
  warningBorder: 'rgba(176, 96, 0, 0.3)',
  error: '#c5161a',
  errorBackground: 'rgba(197, 22, 26, 0.12)',
  errorBorder: 'rgba(197, 22, 26, 0.3)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  borderDefault: 'rgba(0, 0, 0, 0.06)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',
  borderDark: 'rgba(255, 255, 255, 0.06)',
  borderDarkStrong: 'rgba(255, 255, 255, 0.12)',
  dividerLight: 'rgba(0, 0, 0, 0.06)',
  dividerDark: 'rgba(255, 255, 255, 0.06)',
  shadowNone: 'none',
  shadowAmbient: 'rgba(0, 0, 0, 0.04) 0px 2px 8px',
  shadowCard: 'rgba(0, 0, 0, 0.06) 0px 4px 20px',
  shadowElevated: 'rgba(0, 0, 0, 0.08) 0px 8px 30px',
  shadowModal: 'rgba(0, 0, 0, 0.12) 0px 20px 60px',
  shadowFocus: '0 0 0 3px rgba(0, 102, 204, 0.4)',
  pending: '#0066cc',
  pendingBackground: 'rgba(0, 102, 204, 0.12)',
  pendingBorder: 'rgba(0, 102, 204, 0.3)',
  // Additional colors for primitives
  borderAccent: '#b9b9f9',
} as const;

// Typography - Apple/Linear inspired with optical sizing
export const typography = {
  fontFamily: {
    primary: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  size: {
    displayHero: 56,
    displayLarge: 40,
    displayMedium: 28,
    displaySmall: 24,
    title1: 22,
    title2: 20,
    headline: 17,
    body: 17,
    callout: 16,
    subhead: 15,
    footnote: 13,
    caption1: 12,
    caption2: 11,
    micro: 10,
  },
  weight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.07,
    snug: 1.14,
    normal: 1.47,
    relaxed: 1.5,
    button: 1.0,
  },
  letterSpacing: {
    tight: -0.28,
    display: -0.24,
    body: -0.374,
    caption: -0.224,
    micro: -0.12,
    normal: 0,
  },
} as const;

// Spacing System (8px base unit with Apple/Linear refinements)
export const spacing = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 7,
  5: 8,
  6: 9,
  7: 10,
  8: 11,
  9: 12,
  10: 13,
  11: 14,
  12: 15,
  13: 16,
  14: 17,
  15: 18,
  16: 20,
  17: 24,
  18: 28,
  19: 32,
  20: 40,
  21: 48,
  22: 56,
  23: 64,
  24: 80,
  25: 96,
} as const;

// Border Radius Scale - Apple/Linear
export const radius = {
  micro: 4,
  small: 6,
  standard: 8,
  comfortable: 11,
  large: 12,
  xl: 16,
  pill: 999,
  circle: '50%',
} as const;

// Shadow definitions - Apple-style (soft, diffused)
export const shadows = {
  none: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  ambient: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 60,
    elevation: 8,
  },
  focus: {
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 0,
  },
} as const;

// Z-index scale
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  toast: 500,
  tooltip: 600,
} as const;

// Animation durations - Apple-style (smooth, purposeful)
export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
  spring: { damping: 15, stiffness: 150 },
} as const;

// Breakpoints (for reference)
export const breakpoints = {
  mobile: 360,
  mobileLarge: 480,
  tablet: 640,
  tabletLarge: 834,
  desktop: 1024,
  desktopLarge: 1440,
} as const;

// Export all tokens
export const designTokens = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  zIndex,
  animation,
  breakpoints,
} as const;

export type DesignTokens = typeof designTokens;
