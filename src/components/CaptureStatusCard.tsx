// Auto-capture health: tells the user when capture is off, paused by the
// system, or possibly stopped by a battery saver, with the fix one tap away.
import React, { useState } from 'react';
import { View } from 'react-native';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { services } from '@/services';
import { CaptureStatus, daysSince } from '@/services/captureHealth';
import { suppressLock } from '@/services/appLock';
import { pluralize, timeAgo } from '@/utils/format';
import { Button, Card, Icon, IconName, Text } from './ui';

interface Props {
  status: CaptureStatus;
  /** Home shows a short banner only when something needs attention. */
  compact?: boolean;
  onChanged?: () => void;
}

function external(action: () => Promise<unknown>) {
  suppressLock();
  void action();
}

export function CaptureStatusCard({ status, compact = false, onChanged }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [reconnecting, setReconnecting] = useState(false);
  const { state, lastSeenAt, health } = status;
  const quietDays = daysSince(lastSeenAt);

  const turnOn = () => external(() => services.notification.openNotificationAccessSettings());
  const allowBackground = () => external(() => services.notification.requestIgnoreBatteryOptimizations());
  const appSettings = () => external(() => services.notification.openAppDetailsSettings());
  const reconnect = () => {
    setReconnecting(true);
    void services.notification
      .requestListenerRebind()
      .then(() => new Promise((r) => setTimeout(r, 1200)))
      .finally(() => {
        setReconnecting(false);
        onChanged?.();
      });
  };

  let icon: IconName = 'zap';
  let tone = colors.positive;
  let title = 'Auto-capture is on';
  let message = lastSeenAt ? `Last UPI payment seen ${timeAgo(lastSeenAt)}.` : 'Waiting for your first UPI payment.';
  let actions: React.ReactNode = null;

  switch (state) {
    case 'unsupported':
      tone = colors.textTertiary;
      title = 'Auto-capture';
      message = 'Automatic UPI capture is available on Android.';
      break;
    case 'off':
      tone = colors.warning;
      title = 'Auto-capture is off';
      message = 'Allow notification access to log Google Pay, PhonePe, Paytm and BHIM payments automatically.';
      actions = <Button title="Turn on auto-capture" icon="zap" fullWidth onPress={turnOn} />;
      break;
    case 'paused':
      icon = 'alert';
      tone = colors.negative;
      title = 'Auto-capture is paused';
      message = "Android stopped listening for payments. Reconnect, and allow background activity so it doesn't happen again.";
      actions = (
        <View style={styles.actionRow}>
          <Button title="Reconnect" icon="refresh" loading={reconnecting} style={{ flex: 1 }} onPress={reconnect} />
          <Button title="Allow background" variant="secondary" style={{ flex: 1 }} onPress={allowBackground} />
        </View>
      );
      break;
    case 'quiet':
      icon = 'alert';
      tone = colors.warning;
      title = quietDays !== null ? `No payments seen for ${pluralize(quietDays, 'day')}` : 'No payments seen lately';
      message = "If you've paid with UPI since, your phone's battery saver may have stopped auto-capture.";
      actions = (
        <View style={styles.actionRow}>
          <Button title="Allow background" icon="battery" style={{ flex: 1 }} onPress={allowBackground} />
          <Button title="App settings" variant="secondary" style={{ flex: 1 }} onPress={appSettings} />
        </View>
      );
      break;
    case 'battery':
      tone = colors.positive;
      actions = compact ? null : (
        <View style={styles.tip}>
          <Icon name="battery" size={18} color={colors.warning} />
          <Text variant="caption" style={{ flex: 1 }}>
            Allow background activity so battery saver can't pause it
            {health?.manufacturer ? ` on your ${health.manufacturer.charAt(0).toUpperCase()}${health.manufacturer.slice(1)} phone` : ''}.
          </Text>
          <Button title="Allow" size="sm" variant="secondary" onPress={allowBackground} />
        </View>
      );
      break;
    default:
      break;
  }

  // On Home, only problems are worth the space.
  if (compact && (state === 'ok' || state === 'battery' || state === 'unsupported')) return null;

  return (
    <Card style={compact ? styles.compact : undefined}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: tone }]}>
          <Icon name={icon} size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" style={{ marginTop: 2 }}>
            {message}
          </Text>
        </View>
      </View>
      {actions ? <View style={{ marginTop: space.md }}>{actions}</View> : null}
      {!compact && state !== 'unsupported' ? (
        <Text variant="caption" style={{ marginTop: space.md }}>
          Reads payment notifications on this device only. Every payment waits for your review.
        </Text>
      ) : null}
      {!compact && state !== 'unsupported' && state !== 'off' ? (
        <Button title="Manage notification access" variant="ghost" size="sm" onPress={turnOn} style={{ marginTop: space.xs, alignSelf: 'flex-start' }} />
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  compact: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: 12,
    backgroundColor: colors.warningSoft,
  },
}));
