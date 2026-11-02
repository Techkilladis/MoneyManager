import React from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Button, IconButton } from './Button';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

/**
 * Screen header that owns the top safe-area inset.
 * - `large`: tab root — optional eyebrow + 22px title, actions on the right.
 * - default: stacked screen — a top bar with a round back (or close) button
 *   and an optional action, then the same left-aligned title + subtitle.
 *   Pass an empty title for screens that show their own heading.
 */
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  large = false,
  back = false,
  close = false,
  onBack,
  right,
  center,
  style,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  large?: boolean;
  back?: boolean;
  /** Modal screens: an "x" instead of the back arrow. */
  close?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Content centred in the top bar (e.g. a segmented control). */
  center?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  if (large) {
    return (
      <View style={[styles.large, { paddingTop: insets.top + space.xs }, style]}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text variant="caption">{eyebrow}</Text> : null}
          <Text variant="title" style={eyebrow ? { marginTop: space.xxs } : null}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" style={{ marginTop: space.xxs }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[{ paddingTop: insets.top }, style]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {back || close ? (
            <IconButton icon={close ? 'x' : 'arrowLeft'} onPress={goBack} accessibilityLabel={close ? 'Close' : 'Go back'} />
          ) : null}
        </View>
        <View style={styles.center}>{center}</View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
      {title ? (
        <View style={styles.titleBlock}>
          <Text variant="title">{title}</Text>
          {subtitle ? (
            <Text variant="caption" style={{ marginTop: space.xxs }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Sticky bottom area holding the screen's primary action (thumb zone). */
export function BottomBar({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, space.md) + space.xs }, style]}>{children}</View>;
}

/** The one number that matters on a screen, sitting directly on the paper. */
export function KeyFigure({
  label,
  value,
  fraction,
  color,
  children,
  style,
}: {
  label: string;
  value: string;
  /** Paise part, shown smaller in ink3 (".50"). */
  fraction?: string;
  color?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={style}>
      <Text variant="label">{label}</Text>
      <View style={styles.figureRow}>
        <Text variant="hero" numeric color={color} numberOfLines={1}>
          {value}
        </Text>
        {fraction ? (
          <Text variant="title" numeric color={colors.textTertiary} style={styles.figureFraction}>
            {fraction}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

type ChipTone = 'up' | 'down' | 'warn' | 'good' | 'neutral';

/** Small status pill: "↑ 12%", "Due tomorrow", "Nice month". */
export function StatusChip({ label, tone = 'neutral', icon }: { label: string; tone?: ChipTone; icon?: IconName }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const palette: Record<ChipTone, [string, string]> = {
    up: [colors.negativeSoft, colors.negative],
    down: [colors.positiveSoft, colors.positive],
    good: [colors.brandSoft, colors.brand],
    warn: [colors.warningSoft, colors.warning],
    neutral: [colors.surfaceMuted, colors.textSecondary],
  };
  const [bg, fg] = palette[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={14} color={fg} strokeWidth={2.2} /> : null}
      <Text variant="labelStrong" color={fg} numeric>
        {label}
      </Text>
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.brand} size="large" />
      {label ? (
        <Text variant="label" style={{ marginTop: space.sm }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.textTertiary} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="label" align="center" style={styles.emptyMessage}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: space.lg }} /> : null}
      {secondaryLabel && onSecondary ? (
        <Button title={secondaryLabel} variant="ghost" onPress={onSecondary} style={{ marginTop: space.xs }} />
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.centered}>
      <EmptyState icon="alert" title="Something went wrong" message={message} actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    paddingBottom: space.xs,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginLeft: space.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: space.lg,
  },
  side: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  titleBlock: {
    paddingHorizontal: space.lg,
    paddingTop: space.xxs,
    paddingBottom: space.xs,
  },
  bottomBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space.xxs,
  },
  figureFraction: {
    marginLeft: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.background,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xxxl,
  },
  emptyCompact: {
    paddingVertical: space.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  emptyMessage: {
    marginTop: space.xs,
    maxWidth: 280,
  },
}));
