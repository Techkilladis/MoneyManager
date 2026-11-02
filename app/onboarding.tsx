/**
 * First-run setup in three short steps: what the app does, turning on
 * auto-capture (SMS access), and staying on
 * track (alerts + an optional monthly budget).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { services } from '@/services';
import { requestPermission, getPermission } from '@/services/alerts';
import { setSetting } from '@/services/settings';
import { session } from '@/services/session';
import { suppressLock } from '@/services/appLock';
import { parseAmount, sanitizeAmountInput } from '@/utils/format';
import { haptic } from '@/utils/haptics';
import { Button, CategoryAvatar, Icon, IconName, Text, TextField } from '@/components/ui';

type Step = 0 | 1 | 2;

const isAndroid = Platform.OS === 'android';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(0);
  const [fade] = useState(() => new Animated.Value(1));

  const [access, setAccess] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [budget, setBudget] = useState('');

  const refresh = useCallback(() => {
    if (isAndroid) {
      services.notification
        .getCaptureHealth()
        .then((h) => {
          setAccess(!!h?.accessEnabled);
        })
        .catch(() => undefined);
    }
    getPermission()
      .then((p) => setAlerts(p === 'granted'))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const goTo = (next: Step) => {
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const finish = async () => {
    const paise = parseAmount(budget);
    if (paise && paise > 0) await setSetting('overallBudgetPaise', paise);
    await setSetting('onboardingDone', true);
    session.needsOnboarding = false;
    haptic.success();
    router.replace('/');
  };

  const next = () => {
    haptic.select();
    if (step === 0) goTo(isAndroid ? 1 : 2);
    else if (step === 1) goTo(2);
    else void finish();
  };

  const allowSms = () => {
    suppressLock(30_000);
    void services.notification.requestSmsAccess().then((ok) => {
      setAccess(ok);
      if (ok) {
        haptic.success();
        void services.notification.scanSmsInbox();
      } else {
        void services.notification.openAppDetailsSettings();
      }
    });
  };
  const askAlerts = () => {
    suppressLock(30_000);
    void requestPermission().then((ok) => {
      setAlerts(ok);
      if (ok) haptic.success();
    });
  };

  const totalSteps = isAndroid ? 3 : 2;
  const position = isAndroid ? step : step === 0 ? 0 : 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View key={i} style={[styles.dot, i === position && styles.dotActive]} />
          ))}
        </View>
        {step > 0 ? (
          <Button title="Skip" variant="ghost" size="sm" onPress={() => void finish()} />
        ) : (
          <View style={{ height: 36 }} />
        )}
      </View>

      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 ? <Welcome /> : null}

          {step === 1 ? (
            <>
              <Hero icon="zap" />
              <Text variant="title" style={styles.title}>
                Log UPI payments automatically
              </Text>
              <Text variant="body" color={colors.textSecondary} style={styles.lead}>
                Money Manager spots UPI payments in your bank SMS and asks you to confirm each one. Only messages
                that mention UPI are used, and nothing leaves your phone.
              </Text>
              <SetupRow
                icon="inbox"
                title="Allow SMS access"
                description="Reads bank SMS that mention UPI, on this phone only."
                done={access}
                action="Allow"
                onPress={allowSms}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Hero icon="target" />
              <Text variant="title" style={styles.title}>
                Stay on track
              </Text>
              <Text variant="body" color={colors.textSecondary} style={styles.lead}>
                Get a nudge when a budget is nearly used, a reminder before bills are due, and a recap each month.
              </Text>
              <SetupRow
                icon="bell"
                title="Turn on alerts"
                description="Budget alerts, bill reminders and your monthly recap."
                done={alerts}
                action="Turn on"
                onPress={askAlerts}
              />
              <View style={styles.budgetBox}>
                <TextField
                  label="Monthly spending budget (optional)"
                  value={budget}
                  onChangeText={(t) => setBudget(sanitizeAmountInput(t))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 30,000"
                  icon="wallet"
                  returnKeyType="done"
                />
                <Text variant="caption" style={{ marginTop: space.xs }}>
                  You can add budgets for each category later.
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>

      <Button
        title={step === 0 ? 'Get started' : step === 1 ? (access ? 'Continue' : 'Continue without it') : 'Start using Money Manager'}
        size="lg"
        fullWidth
        onPress={next}
      />
    </View>
  );
}

function Welcome() {
  const { colors } = useTheme();
  const styles = useStyles();
  const points: { icon: IconName; title: string; text: string }[] = [
    { icon: 'zap', title: 'Captures UPI payments', text: 'No typing for most of your spending.' },
    { icon: 'target', title: 'Budgets that warn you', text: 'Know before you overspend, not after.' },
    { icon: 'shieldCheck', title: 'Private by design', text: 'Your data stays on this phone.' },
  ];
  return (
    <>
      {/* The product doing its job: a bank SMS becomes a tidy, reviewable payment. */}
      <View style={styles.vignette}>
        <View style={[styles.vCard, styles.vSms]}>
          <View style={styles.inline}>
            <Icon name="message" size={16} color={colors.textTertiary} />
            <Text variant="caption">HDFC Bank · now</Text>
          </View>
          <Text variant="label" style={{ marginTop: space.xs }}>
            Rs 450.00 debited via UPI to SWIGGY. Ref 4291…
          </Text>
        </View>
        <View style={[styles.vCard, styles.vTx]}>
          <View style={styles.inline}>
            <CategoryAvatar icon="utensils" color="#F97316" size={44} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Swiggy</Text>
              <Text variant="caption">Food · just now</Text>
            </View>
            <Text variant="bodyStrong" numeric>
              −₹450
            </Text>
          </View>
          <View style={[styles.inline, { marginTop: space.sm }]}>
            <View style={[styles.vPill, { borderWidth: 1, borderColor: colors.border }]}>
              <Text variant="label">
                Ignore
              </Text>
            </View>
            <View style={[styles.vPill, { backgroundColor: colors.brand }]}>
              <Icon name="check" size={14} color={colors.textOnBrand} strokeWidth={2.5} />
              <Text variant="labelStrong" color={colors.textOnBrand}>
                Confirm
              </Text>
            </View>
          </View>
        </View>
      </View>
      <Text variant="title" style={styles.title}>
        Every rupee, accounted for
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.lead}>
        See where your money goes without the busywork.
      </Text>
      <View style={{ gap: space.lg, marginTop: space.xxl }}>
        {points.map((p, i) => (
          <View key={p.title} style={styles.point}>
            <View style={[styles.pointIcon, { backgroundColor: i === 0 ? colors.brandSoft : colors.surfaceMuted }]}>
              <Icon name={p.icon} size={20} color={i === 0 ? colors.brand : colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{p.title}</Text>
              <Text variant="label">{p.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

function Hero({ icon }: { icon: IconName }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.heroIcon}>
      <Icon name={icon} size={32} color={colors.brand} />
    </View>
  );
}

function SetupRow({
  icon,
  title,
  description,
  done,
  action,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  done: boolean;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.setupRow, done && styles.setupRowDone]}>
      <View style={[styles.setupIcon, { backgroundColor: done ? colors.brand : colors.surfaceMuted }]}>
        <Icon name={done ? 'check' : icon} size={20} color={done ? colors.textOnBrand : colors.text} strokeWidth={done ? 3 : 2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>
          {done ? 'Done' : description}
        </Text>
      </View>
      {done ? null : <Button title={action} size="sm" onPress={onPress} />}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: space.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.text,
  },
  body: {
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  vignette: {
    height: 232,
  },
  vCard: {
    position: 'absolute',
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  vSms: {
    top: 8,
    left: 8,
    right: 40,
    borderColor: colors.border,
  },
  vTx: {
    bottom: 8,
    left: 32,
    right: 0,
    borderColor: colors.brandSoftBorder,
  },
  vPill: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    marginTop: space.xl,
  },
  lead: {
    marginTop: space.xs,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginTop: space.lg,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setupRowDone: {
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  setupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetBox: {
    marginTop: space.xl,
  },
}));
