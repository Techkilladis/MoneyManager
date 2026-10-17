import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '@/design/tokens';
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

const palette: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.brand, bgPressed: colors.brandPressed, fg: colors.textOnBrand },
  secondary: { bg: colors.brandSoft, bgPressed: colors.brandSoftBorder, fg: colors.brand },
  ghost: { bg: 'transparent', bgPressed: colors.surfacePressed, fg: colors.brand },
  danger: { bg: colors.negative, bgPressed: '#C9363B', fg: colors.textOnBrand },
  dangerSoft: { bg: colors.negativeSoft, bgPressed: '#F9D6D7', fg: colors.negative },
  outline: { bg: colors.surface, bgPressed: colors.surfaceMuted, fg: colors.text, border: colors.border },
};

const sizes: Record<Size, { height: number; paddingH: number; icon: number; text: 'bodyStrong' | 'labelStrong' }> = {
  lg: { height: 54, paddingH: space.xl, icon: 20, text: 'bodyStrong' },
  md: { height: 46, paddingH: space.lg, icon: 18, text: 'labelStrong' },
  sm: { height: 36, paddingH: space.md, icon: 16, text: 'labelStrong' },
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
  const p = palette[variant];
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
          backgroundColor: pressed ? p.bgPressed : p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
          opacity: inactive && !loading ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        variant === 'primary' && !inactive ? shadow.brand : null,
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
  background?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  size = 40,
  color = colors.text,
  background = colors.surface,
  style,
  ...rest
}: IconButtonProps) {
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
          backgroundColor: pressed ? colors.surfacePressed : background,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
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
});
