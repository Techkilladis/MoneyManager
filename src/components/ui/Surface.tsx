import React from 'react';
import { Pressable, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { inkOf, radius, space, tint } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

interface CardProps extends ViewProps {
  padded?: boolean;
  /** No hairline border (for cards that sit on a tinted wash). */
  flat?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Flat white card with a hairline border — the only container style. */
export function Card({ padded = true, flat = false, onPress, style, children, ...rest }: CardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const base = [styles.card, padded && styles.cardPadded, flat && styles.cardFlat, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
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

/**
 * Round badge holding an icon. With a colour it is tinted from it (category
 * style); without one it is neutral ink on hush (settings style).
 */
export function IconTile({
  icon,
  color,
  size = 40,
}: {
  icon: IconName;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ? tint(color, 0.14) : colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={color ? inkOf(color) : colors.text} />
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string | null;
  subtitleColor?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  value?: string;
  chevron?: boolean;
  destructive?: boolean;
  /** Semibold title, for rows whose title is the main content. */
  strong?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function ListRow({
  title,
  subtitle,
  subtitleColor,
  left,
  right,
  value,
  chevron,
  destructive,
  strong,
  onPress,
  disabled,
}: ListRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const content = (
    <>
      {left}
      <View style={styles.rowBody}>
        <Text variant={strong ? 'bodyStrong' : 'body'} color={destructive ? colors.negative : colors.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={subtitleColor} numberOfLines={2} style={styles.rowSubtitle}>
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
      {chevron ? <Icon name="chevronRight" size={18} color={colors.textTertiary} /> : null}
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
  right,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  /** Free-form trailing content (e.g. a count) when there is no action. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text variant="heading">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          {({ pressed }) => (
            <Text variant="labelStrong" color={pressed ? colors.brandPressed : colors.brand}>
              {action}
            </Text>
          )}
        </Pressable>
      ) : (
        right ?? null
      )}
    </View>
  );
}

/** Small label above a group of rows (Settings: "Organize", "Backup & data"). */
export function GroupLabel({ title, style }: { title: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <Text variant="overline" style={[styles.groupLabel, style]}>
      {title}
    </Text>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardFlat: {
    borderWidth: 0,
  },
  cardPadded: {
    padding: space.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
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
  groupLabel: {
    marginBottom: space.sm,
  },
}));
