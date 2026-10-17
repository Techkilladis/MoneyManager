/**
 * First-run setup in three short steps: what the app does, turning on
 * auto-capture (notification access + background activity), and staying on
 * track (alerts + an optional monthly budget).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Button, Icon, IconName, Text, TextField } from '@/components/ui';

type Step = 0 | 1 | 2;

const isAndroid = Platform.OS === 'android';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(0);
  const [fade] = useState(() => new Animated.Value(1));

  const [access, setAccess] = useState(false);
  const [battery, setBattery] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [budget, setBudget] = useState('');

  const refresh = useCallback(() => {
    if (isAndroid) {
      services.notification
        .getCaptureHealth()
        .then((h) => {
          setAccess(!!h?.accessEnabled);
          setBattery(!!h?.ignoringBatteryOptimizations);
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

  const openAccess = () => {
    suppressLock();
    void services.notification.openNotificationAccessSettings();
  };
  const openBattery = () => {
    suppressLock();
    void services.notification.requestIgnoreBatteryOptimizations();
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
              <Text variant="title" align="center" style={styles.title}>
                Log UPI payments automatically
              </Text>
              <Text variant="body" color={colors.textSecondary} align="center" style={styles.lead}>
                Money Manager reads payment notifications from Google Pay, PhonePe, Paytm and BHIM, and asks you to
                confirm each one. Nothing leaves your phone.
              </Text>
              <SetupRow
                icon="bell"
                title="Allow notification access"
                description="So payments are noticed the moment they happen."
                done={access}
                action="Allow"
                onPress={openAccess}
              />
              <SetupRow
                icon="battery"
                title="Keep running in the background"
                description="Stops battery saver from pausing auto-capture."
                done={battery}
                action="Allow"
                onPress={openBattery}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Hero icon="target" />
              <Text variant="title" align="center" style={styles.title}>
                Stay on track
              </Text>
              <Text variant="body" color={colors.textSecondary} align="center" style={styles.lead}>
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
    { icon: 'shield', title: 'Private by design', text: 'Your data stays on this phone.' },
  ];
  return (
    <>
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeArt}>
        <View style={styles.logo}>
          <Icon name="wallet" size={36} color="#FFFFFF" />
        </View>
        <View style={[styles.floatChip, { top: 22, left: 18 }]}>
          <Text variant="caption" color="#FFFFFF">
            ☕ Chai Point · ₹40
          </Text>
        </View>
        <View style={[styles.floatChip, { bottom: 26, right: 16 }]}>
          <Text variant="caption" color="#FFFFFF">
            🛒 Groceries · ₹1,240
          </Text>
        </View>
      </LinearGradient>
      <Text variant="title" align="center" style={styles.title}>
        Every rupee, accounted for
      </Text>
      <Text variant="body" color={colors.textSecondary} align="center" style={styles.lead}>
        See where your money goes without the busywork.
      </Text>
      <View style={{ gap: space.md, marginTop: space.lg }}>
        {points.map((p) => (
          <View key={p.title} style={styles.point}>
            <View style={styles.pointIcon}>
              <Icon name={p.icon} size={20} color={colors.brand} />
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
    <View style={styles.heroWrap}>
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
        <Icon name={icon} size={36} color="#FFFFFF" />
      </LinearGradient>
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
      <View style={[styles.setupIcon, { backgroundColor: done ? colors.positiveSoft : colors.brandSoft }]}>
        <Icon name={done ? 'check' : icon} size={20} color={done ? colors.positive : colors.brand} strokeWidth={done ? 3 : 2} />
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
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.brand,
  },
  body: {
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  welcomeArt: {
    height: 200,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatChip: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  title: {
    marginTop: space.xl,
  },
  lead: {
    marginTop: space.xs,
    paddingHorizontal: space.xs,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pointIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: space.lg,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setupRowDone: {
    borderColor: colors.positiveSoft,
  },
  setupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetBox: {
    marginTop: space.xl,
  },
}));
