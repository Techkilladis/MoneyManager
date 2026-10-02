// Design Tokens - Apple-inspired design system for Money Manager

// Color Palette
export const colors = {
  // Primary surfaces
  background: '#f5f5f7',           // Light gray section background
  backgroundDark: '#000000',       // Pure black for dark sections
  surface: '#ffffff',              // Card/surface background
  surfaceDark: '#272729',          // Dark card background
  surfaceElevated: '#fafafc',      // Elevated surface (search inputs, etc.)
  
  // Text colors
  textPrimary: '#1d1d1f',          // Near black - primary text on light
  textSecondary: 'rgba(0, 0, 0, 0.6)',  // Secondary text
  textTertiary: 'rgba(0, 0, 0, 0.38)',  // Tertiary/disabled text
  textOnDark: '#ffffff',           // Text on dark backgrounds
  textOnDarkSecondary: 'rgba(255, 255, 255, 0.7)', // Secondary on dark
  textOnDarkTertiary: 'rgba(255, 255, 255, 0.48)', // Tertiary on dark
  
  // Interactive
  accent: '#0071e3',               // Apple Blue - primary interactive
  accentHover: '#0077ed',          // Hover state
  accentActive: '#ededf2',         // Active/pressed state
  linkOnLight: '#0066cc',          // Links on light backgrounds
  linkOnDark: '#2997ff',           // Links on dark backgrounds
  
  // Semantic colors
  success: '#15be53',              // Green for positive/confirmed
  successBackground: 'rgba(21, 190, 83, 0.15)',
  successBorder: 'rgba(21, 190, 83, 0.4)',
  warning: '#9b6829',              // Amber for warnings
  error: '#ea2261',                // Ruby red for errors
  errorBackground: 'rgba(234, 34, 97, 0.15)',
  errorBorder: 'rgba(234, 34, 97, 0.4)',
  
  // Borders
  borderLight: 'rgba(0, 0, 0, 0.06)',    // Subtle borders
  borderDefault: 'rgba(0, 0, 0, 0.08)',  // Default borders
  borderAccent: '#b9b9f9',               // Accent borders
  
  // Shadows
  shadowCard: 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0px', // Product card shadow
  shadowAmbient: 'rgba(23, 23, 23, 0.06)',            // Subtle ambient
  shadowStandard: 'rgba(23, 23, 23, 0.08) 0px 15px 35px', // Standard card
} as const;

// Typography
export const typography = {
  fontFamily: {
    primary: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  
  // Scale based on Apple's optical sizing
  size: {
    displayHero: 56,      // 3.5rem - Hero headlines
    displayLarge: 40,     // 2.5rem - Section headings
    displayMedium: 28,    // 1.75rem - Tile headings
    title1: 21,           // 1.31rem - Card titles
    title2: 21,           // 1.31rem - Sub-headings
    headline: 17,         // 1.06rem - Body emphasized
    body: 17,             // 1.06rem - Standard body
    callout: 16,          // 1rem - Slightly smaller body
    subhead: 15,          // 0.94rem
    footnote: 13,         // 0.81rem - Captions
    caption1: 12,         // 0.75rem - Small labels
    caption2: 11,         // 0.69rem
    micro: 10,            // 0.63rem - Fine print
  },
  
  weight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  lineHeight: {
    tight: 1.07,      // Headlines
    snug: 1.14,       // Display
    normal: 1.47,     // Body
    relaxed: 1.5,     // Loose
    button: 1.0,      // Buttons
  },
  
  letterSpacing: {
    tight: -0.28,     // 56px
    display: -0.24,   // 28-40px
    body: -0.374,     // 17px
    caption: -0.224,  // 13-14px
    micro: -0.12,     // 10-12px
    normal: 0,
  },
} as const;

// Spacing System (8px base unit)
export const spacing = {
  0: 0,
  1: 2,
  2: 4,
  3: 5,
  4: 6,
  5: 7,
  6: 8,
  7: 9,
  8: 10,
  9: 11,
  10: 12,
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

// Border Radius Scale
export const radius = {
  micro: 4,       // Small containers, tags
  small: 6,       // Standard buttons, inputs
  standard: 8,    // Buttons, cards, image containers
  comfortable: 11, // Search inputs, filter buttons
  large: 12,      // Feature panels, lifestyle images
  pill: 999,      // Pill CTAs (980px approx)
  circle: '50%',  // Media controls
} as const;

// Shadow definitions
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  ambient: {
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  standard: {
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.08,
    shadowRadius: 35,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 8,
  },
  focus: {
    shadowColor: '#0071e3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2,
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

// Animation durations
export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

// Breakpoints (for reference - React Native handles this differently)
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