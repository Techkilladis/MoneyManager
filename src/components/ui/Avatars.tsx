import React from 'react';
import { View, ViewProps } from 'react-native';
import { inkOf, tint } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { categoryIcon, initials } from '@/domain/glyphs';
import { Icon } from './Icon';
import { Text } from './Text';

/** Category line icon on a round badge tinted with the category colour. */
export function CategoryAvatar({
  icon,
  color,
  size = 40,
  accessibilityLabel,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: number;
  accessibilityLabel?: string;
} & ViewProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const base = color ?? colors.textTertiary;
  return (
    <View
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(base, 0.14) }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Icon name={categoryIcon(icon)} size={Math.round(size * 0.46)} color={inkOf(base)} />
    </View>
  );
}

/** Placeholder badge for transactions without a category yet. */
export function UncategorizedAvatar({
  size = 40,
  accessibilityLabel = 'Uncategorized',
}: {
  size?: number;
  accessibilityLabel?: string;
} & ViewProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[styles.center, styles.dashed, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      <Icon name="tag" size={Math.round(size * 0.42)} color={colors.textTertiary} />
    </View>
  );
}

export function MemberAvatar({
  name,
  color,
  size = 40,
  accessibilityLabel,
}: {
  name: string;
  color: string | null | undefined;
  size?: number;
  accessibilityLabel?: string;
} & ViewProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const base = color ?? colors.brand;
  return (
    <View
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(base, 0.16) }]}
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityRole="image"
    >
      <Text variant="labelStrong" color={inkOf(base)} style={{ fontSize: Math.round(size * 0.33), lineHeight: Math.round(size * 0.42) }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  center: { alignItems: 'center', justifyContent: 'center' },
  dashed: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
}));
