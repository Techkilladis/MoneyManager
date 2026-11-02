import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle, StyleSheet } from 'react-native';
import { font, fontFamily } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import type { Palette } from '@/design/tokens';

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

export function Text({ variant = 'body', color, align, numeric, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten([
    variants[variant],
    { color: color ?? defaultColor(colors)[variant] },
    align ? { textAlign: align } : null,
    numeric ? NUMERIC : null,
    style,
  ]);
  // A custom family plus fontWeight makes Android synthesise or fall back,
  // so the weight is expressed through the family alone.
  const { fontWeight, ...resolved } = flat;
  return <RNText {...rest} style={[resolved, { fontFamily: fontFor(fontWeight) }]} />;
}
