import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, tint } from '@/design/tokens';
import { Button, IconButton } from './Button';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

/**
 * Screen header that owns the top safe-area inset.
 * - `large`: tab-root style with a big title (and optional eyebrow text).
 * - default: stacked screen with a back button and centred title.
 */
export function ScreenHeader({
  title,
  eyebrow,
  large = false,
  back = false,
  onBack,
  right,
  style,
}: {
  title: string;
  eyebrow?: string;
  large?: boolean;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  if (large) {
    return (
      <View style={[styles.large, { paddingTop: insets.top + space.sm }, style]}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text variant="label" color={colors.textTertiary}>
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="title" style={{ fontSize: 28, lineHeight: 34 }}>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.compact, { paddingTop: insets.top + space.xs }, style]}>
      <View style={styles.side}>
        {back ? <IconButton icon="arrowLeft" onPress={goBack} accessibilityLabel="Go back" /> : null}
      </View>
      <Text variant="heading" numberOfLines={1} style={styles.compactTitle}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.brand} size="large" />
      {label ? (
        <Text variant="label" color={colors.textTertiary} style={{ marginTop: space.sm }}>
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
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.brand} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="label" align="center" style={styles.emptyMessage}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: space.lg }} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button title={secondaryLabel} variant="ghost" onPress={onSecondary} style={{ marginTop: space.xs }} />
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <EmptyState icon="alert" title="Something went wrong" message={message} actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginLeft: space.sm,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
  compactTitle: {
    flex: 1,
    textAlign: 'center',
  },
  side: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: space.xs,
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
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: tint(colors.brand, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  emptyMessage: {
    marginTop: space.xs,
    maxWidth: 300,
  },
});
