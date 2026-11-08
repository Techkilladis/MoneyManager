import React, { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Text as RNText, TextProps as RNTextProps, TextStyle, StyleSheet } from 'react-native';
import { font, fontFamily } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import type { Palette } from '@/design/tokens';

// Default font scale — users can override via AccessibilityInfo.setFontScale.
const DEFAULT_SCALE = 1;

/**
 * Dynamic type hook — reads the system font scale and updates when it changes.
 * React Native exposes this through AccessibilityInfo for manual overrides,
 * but does not yet listen to OS-level font size changes on all platforms.
 */
function useFontScale(): number {
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);

  useEffect(() => {
    // iOS + Android: scale from AccessibilityInfo reflects user-set font size.
    // Type assertion for RN 0.76 compatibility — getFontScale may not be in older type defs.
    try {
      const info: any = AccessibilityInfo as any;
      if (typeof info.getFontScale === 'function') {
        info.getFontScale().then((s: number) => setScale(s));
      }
    } catch {
      // getFontScale not available — fall back to default.
    }

    // Android fires this event; iOS does not but reads the correct value on mount.
    try {
      const info: any = AccessibilityInfo as any;
      if (typeof info.addEventListener === 'function') {
        const sub: any = info.addEventListener('fontScaleChanged', ({ fontScale }: { fontScale: number }) => setScale(fontScale));
        if (sub && typeof sub.remove === 'function') {
          return () => sub.remove();
        }
      }
    } catch {
      // Event listener not available — fall back to single read.
    }
    return undefined;
  }, []);

  return scale;
}

const variants = StyleSheet.create({
  hero: { fontSize: font.size.hero, lineHeight: 48, fontWeight: font.weight.semibold, letterSpacing: -1 },
  title: { fontSize: font.size.title, lineHeight: 28, fontWeight: font.weight.semibold, letterSpacing: -0.4 },
  heading: { fontSize: font.size.body, lineHeight: 22, fontWeight: font.weight.semibold, letterSpacing: -0.1 },
  body: { fontSize: font.size.body, lineHeight: 22, fontWeight: font.weight.regular, letterSpacing: -0.1 },
  bodyStrong: { fontSize: font.size.body, lineHeight: 22, fontWeight: font.weight.semibold, letterSpacing: -0.1 },
  label: { fontSize: font.size.label, lineHeight: 18, fontWeight: font.weight.regular },
  labelStrong: { fontSize: font.size.label, lineHeight: 18, fontWeight: font.weight.semibold },
  caption: { fontSize: font.size.caption, lineHeight: 18, fontWeight: font.weight.regular },
  overline: { fontSize: font.size.label, lineHeight: 18, fontWeight: font.weight.semibold },
});

export type TextVariant = keyof typeof variants;

const defaultColor = (colors: Palette): Record<TextVariant, string> => ({
  hero: colors.text,
  title: colors.text,
  heading: colors.text,
  body: colors.text,
  bodyStrong: colors.text,
  label: colors.textSecondary,
  labelStrong: colors.text,
  caption: colors.textTertiary,
  overline: colors.textTertiary,
});

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Tabular figures, for amounts that should line up. */
  numeric?: boolean;
}

const NUMERIC: TextStyle = { fontVariant: ['tabular-nums'], letterSpacing: -0.4 };

/** Inter ships one family per weight; anything 500+ uses the semibold face. */
export function fontFor(weight: TextStyle['fontWeight']): string {
  const n = typeof weight === 'number' ? weight : weight === 'bold' ? 700 : Number(weight ?? 400);
  return n >= 500 ? fontFamily.semibold : fontFamily.regular;
}

export function Text({ variant = 'body', color, align, numeric, style, ...rest }: TextProps): ReactNode {
  const { colors } = useTheme();
  const fontScale = useFontScale();

  // Build scaled variants so the multiplier applies to fontSize and lineHeight together.
  const base = variants[variant];
  const flat = StyleSheet.flatten([
    base,
    { color: color ?? defaultColor(colors)[variant] },
    align ? { textAlign: align } : null,
    numeric ? NUMERIC : null,
    style,
  ]);

  const scaledFontSize = (flat?.fontSize ?? 16) * fontScale;
  const scaledLineHeight = ((flat?.lineHeight as number) ?? (flat?.fontSize as number) ?? 16) * fontScale;

  // A custom family plus fontWeight makes Android synthesise or fall back,
  // so the weight is expressed through the family alone.
  const { fontWeight, ...resolved } = { ...flat, fontSize: scaledFontSize, lineHeight: scaledLineHeight };
  return <RNText {...rest} style={[resolved, { fontFamily: fontFor(fontWeight) }]} />;
}
