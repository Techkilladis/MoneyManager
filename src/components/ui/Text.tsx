import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle, StyleSheet } from 'react-native';
import { colors, font } from '@/design/tokens';

const variants = StyleSheet.create({
  hero: { fontSize: font.size.hero, lineHeight: 42, fontWeight: font.weight.bold, letterSpacing: -0.8 },
  title: { fontSize: font.size.title, lineHeight: 28, fontWeight: font.weight.bold, letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: font.weight.semibold, letterSpacing: -0.2 },
  body: { fontSize: font.size.body, lineHeight: 22, fontWeight: font.weight.regular },
  bodyStrong: { fontSize: font.size.body, lineHeight: 22, fontWeight: font.weight.semibold },
  label: { fontSize: font.size.label, lineHeight: 20, fontWeight: font.weight.regular },
  labelStrong: { fontSize: font.size.label, lineHeight: 20, fontWeight: font.weight.semibold },
  caption: { fontSize: font.size.caption, lineHeight: 16, fontWeight: font.weight.regular },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

export type TextVariant = keyof typeof variants;

const defaultColor: Record<TextVariant, string> = {
  hero: colors.text,
  title: colors.text,
  heading: colors.text,
  body: colors.text,
  bodyStrong: colors.text,
  label: colors.textSecondary,
  labelStrong: colors.text,
  caption: colors.textTertiary,
  overline: colors.textTertiary,
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Tabular figures, for amounts that should line up. */
  numeric?: boolean;
}

export function Text({ variant = 'body', color, align, numeric, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        variants[variant],
        { color: color ?? defaultColor[variant] },
        align ? { textAlign: align } : null,
        numeric ? styles.numeric : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  numeric: { fontVariant: ['tabular-nums'] },
});
