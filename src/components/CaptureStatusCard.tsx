// Auto-capture status: tells the user whether SMS access is on and whether new
// payments pop up for review even after the app is swiped away, with each fix
// one tap away.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { services } from '@/services';
import { CaptureStatus, CaptureStep, openCaptureStep } from '@/services/captureHealth';
import { suppressLock } from '@/services/appLock';
import { timeAgo } from '@/utils/format';
import { Button, Card, Icon, IconName, Text } from './ui';

interface Props {
  status: CaptureStatus;
  /** Home shows a short banner only when something needs attention. */
  compact?: boolean;
  onChanged?: () => void;
}

export function CaptureStatusCard({ status, compact = false, onChanged }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const { state, lastSeenAt, steps, missed } = status;
  const todo = steps.filter((s) => !s.done);

  const turnOn = () => {
    suppressLock(30_000);
    setRequesting(true);
    void services.notification
      .requestSmsAccess()
      .then(async (granted) => {
        setDenied(!granted);
        if (granted) await services.notification.scanSmsInbox();
      })
      .finally(() => {
        setRequesting(false);
        onChanged?.();
      });
  };
  const appSettings = () => {
    suppressLock();
    void services.notification.openAppDetailsSettings();
  };
  const openStep = (step: CaptureStep) => {
    suppressLock();
    void openCaptureStep(step.key).finally(() => onChanged?.());
  };

  let icon: IconName = 'zap';
  let tone = colors.positive;
  let title = 'Auto-capture is on';
  let message = lastSeenAt ? `Last UPI payment seen ${timeAgo(lastSeenAt)}.` : 'Waiting for your first UPI bank SMS.';
  let actions: React.ReactNode = null;

  if (state === 'unsupported') {
    tone = colors.textTertiary;
    title = 'Auto-capture';
    message = 'Automatic UPI capture is available on Android.';
  } else if (state === 'off') {
    tone = colors.warning;
    title = 'Auto-capture is off';
    message = 'Allow SMS access so Money Manager can spot UPI payments in your bank messages.';
    actions = (
      <View style={styles.actionRow}>
        <Button title="Allow SMS access" icon="zap" loading={requesting} style={{ flex: 1 }} onPress={turnOn} />
        {denied ? <Button title="App settings" variant="secondary" style={{ flex: 1 }} onPress={appSettings} /> : null}
      </View>
    );
  } else if (compact && missed) {
    icon = 'alert';
    tone = colors.warning;
    title = "A payment didn't pop up";
    message = 'Your phone kept Money Manager closed when a bank SMS arrived. The payment is waiting for review.';
    actions = <Button title="Fix in Settings" icon="settings" variant="secondary" fullWidth onPress={() => router.push('/settings')} />;
  } else if (todo.length === 0 && !missed) {
    message += ' New payments pop up for review, even when the app is closed.';
  }

  // On Home, only problems are worth the space.
  if (compact && state !== 'off' && !missed) return null;

  const showSteps = !compact && state === 'ok' && (todo.length > 0 || missed);

  return (
    <Card style={compact ? undefined : state === 'ok' && !missed ? styles.on : undefined}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: tone }]}>
          <Icon name={icon} size={20} color={colors.textOnBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" style={{ marginTop: 2 }}>
            {message}
          </Text>
        </View>
      </View>
      {actions ? <View style={{ marginTop: space.md }}>{actions}</View> : null}

      {showSteps ? (
        <View style={{ marginTop: space.md }}>
          {missed ? (
            <View style={styles.missed}>
              <Icon name="alert" size={16} color={colors.warning} />
              <Text variant="caption" color={colors.text} style={{ flex: 1 }}>
                A bank SMS arrived while Money Manager was closed and your phone didn&apos;t let it open. Check these, then
                swipe the app away and try a small payment.
              </Text>
            </View>
          ) : null}
          <Text variant="label" style={{ marginBottom: space.xs }}>
            Pop up even when the app is closed
          </Text>
          {steps.map((step, i) => (
            <StepRow key={step.key} step={step} index={i + 1} onPress={() => openStep(step)} />
          ))}
        </View>
      ) : null}

      {!compact && state !== 'unsupported' ? (
        <Text variant="caption" style={{ marginTop: space.md }}>
          Only bank SMS that mention UPI are read, on this device only. Nothing is uploaded, and every payment waits for your review.
        </Text>
      ) : null}
    </Card>
  );
}

function StepRow({ step, index, onPress }: { step: CaptureStep; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${step.title}${step.done ? ', done' : ''}`}
      style={({ pressed }) => [styles.step, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.stepBadge, { backgroundColor: step.done ? colors.positive : colors.surface }]}>
        {step.done ? (
          <Icon name="check" size={14} color={colors.textOnBrand} strokeWidth={3} />
        ) : (
          <Text variant="caption" color={colors.brand} style={{ fontWeight: '700' }}>
            {index}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" color={colors.text} style={{ fontWeight: '600' }}>
          {step.title}
        </Text>
        <Text variant="caption">{step.detail}</Text>
      </View>
      {step.done ? null : (
        <Text variant="labelStrong" color={colors.brand}>
          Allow
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  on: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandSoftBorder,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  missed: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.sm,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
