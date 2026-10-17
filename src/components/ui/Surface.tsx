import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { radius, shadow, space, tint } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

interface CardProps extends ViewProps {
  padded?: boolean;
  flat?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ padded = true, flat = false, onPress, style, children, ...rest }: CardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const base = [styles.card, padded && styles.cardPadded, !flat && shadow.card, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfaceMuted }]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.divider, { marginLeft: inset }, style]} />;
}

/** Rounded square holding an icon, tinted from a base colour. */
export function IconTile({
  icon,
  color: colorProp,
  size = 40,
}: {
  icon: IconName;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.brand;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: tint(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string | null;
  left?: React.ReactNode;
  right?: React.ReactNode;
  value?: string;
  chevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function ListRow({ title, subtitle, left, right, value, chevron, destructive, onPress, disabled }: ListRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const content = (
    <>
      {left ? <View style={styles.rowLeft}>{left}</View> : null}
      <View style={styles.rowBody}>
        <Text variant="bodyStrong" color={destructive ? colors.negative : colors.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={2} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" color={colors.textTertiary} numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {right}
      {chevron ? <Icon name="chevronRight" size={18} color={colors.textDisabled} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && { opacity: 0.5 }]}
    >
      {content}
    </Pressable>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text variant="heading">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          {({ pressed }) => (
            <Text variant="labelStrong" color={pressed ? colors.brandPressed : colors.brand}>
              {action}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  cardPadded: {
    padding: space.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowLeft: {
    marginRight: space.xxs,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  rowValue: {
    maxWidth: '45%',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
}));
