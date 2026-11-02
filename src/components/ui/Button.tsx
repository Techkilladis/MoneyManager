import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { radius, space } from '@/design/tokens';
import type { Palette } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft' | 'outline';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

// primary: moss fill · secondary/outline: card with a hairline · ghost: moss text
// danger: clay wash (confirming a destructive step) · dangerSoft: clay text only
const variantColors = (colors: Palette): Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> => ({
  primary: { bg: colors.brand, bgPressed: colors.brandPressed, fg: colors.textOnBrand },
  secondary: { bg: colors.surface, bgPressed: colors.surfaceMuted, fg: colors.text, border: colors.border },
  outline: { bg: colors.surface, bgPressed: colors.surfaceMuted, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', bgPressed: colors.surfaceMuted, fg: colors.brand },
  danger: { bg: colors.negativeSoft, bgPressed: colors.surfacePressed, fg: colors.negative },
  dangerSoft: { bg: 'transparent', bgPressed: colors.surfaceMuted, fg: colors.negative },
});

const sizes: Record<Size, { height: number; paddingH: number; icon: number; text: 'bodyStrong' | 'labelStrong'; radius: number }> = {
  lg: { height: 56, paddingH: space.xl, icon: 20, text: 'bodyStrong', radius: radius.lg },
  md: { height: 48, paddingH: space.lg, icon: 18, text: 'bodyStrong', radius: radius.lg },
  sm: { height: 44, paddingH: space.md, icon: 16, text: 'labelStrong', radius: radius.pill },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const p = variantColors(colors)[variant];
  const s = sizes[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingH,
          borderRadius: s.radius,
          backgroundColor: pressed ? p.bgPressed : p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
          opacity: inactive && !loading ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={s.icon} color={p.fg} strokeWidth={2.2} /> : null}
          <Text variant={s.text} color={p.fg} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconName;
  size?: number;
  color?: string;
  /** Fill colour; without one the button is a card circle with a hairline. */
  background?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  size = 44,
  color: colorProp,
  background,
  style,
  ...rest
}: IconButtonProps) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.text;
  const styles = useStyles();
  const outlined = background === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      {...rest}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed ? colors.surfacePressed : background ?? colors.surface,
          borderWidth: outlined ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} color={color} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  fullWidth: { alignSelf: 'stretch' },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
