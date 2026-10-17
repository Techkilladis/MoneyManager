import React from 'react';
import { View } from 'react-native';
import { tint } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { categoryGlyph, initials } from '@/domain/glyphs';
import { Icon } from './Icon';
import { Text } from './Text';

/** Category emoji on a soft tile of the category colour. */
export function CategoryAvatar({
  icon,
  color,
  size = 44,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.center,
        { width: size, height: size, borderRadius: size * 0.34, backgroundColor: tint(color ?? colors.textTertiary, 0.16) },
      ]}
    >
      <Text style={{ fontSize: size * 0.46, lineHeight: size * 0.6 }}>{categoryGlyph(icon)}</Text>
    </View>
  );
}

/** Placeholder avatar for transactions without a category yet. */
export function UncategorizedAvatar({ size = 44 }: { size?: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.center,
        styles.dashed,
        { width: size, height: size, borderRadius: size * 0.34 },
      ]}
    >
      <Icon name="tag" size={size * 0.42} color={colors.textTertiary} />
    </View>
  );
}

export function MemberAvatar({
  name,
  color,
  size = 32,
}: {
  name: string;
  color: string | null | undefined;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const base = color ?? colors.brand;
  return (
    <View
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(base, 0.18) }]}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: base }}>{initials(name)}</Text>
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
