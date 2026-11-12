import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import {
  alertsService,
  backupService,
  budgetService,
  categoryService,
  ledgerService,
  memberService,
  recurringService,
  services,
  splitService,
} from '@/services';
import { dataEvents } from '@/services/events';
import { CaptureStatus, getCaptureStatus } from '@/services/captureHealth';
import { notificationDetectionService } from '@/services/notificationDetection';
import { getLockSupport, LockSupport, suppressLock } from '@/services/appLock';
import { getSettings, LockTimeout, setSetting, SettingsShape, ThemePreference } from '@/services/settings';
import { session } from '@/services/session';
import { BackupFile, summarize } from '@/services/backup';
import { seedDevelopmentData } from '@/services/seedData';
import { useScreenData } from '@/hooks/useScreenData';
import { formatFullDate, formatINR, pluralize, timeAgo } from '@/utils/format';
import { haptic } from '@/utils/haptics';
import { CaptureStatusCard } from '@/components/CaptureStatusCard';
import {
  Button,
  Card,
  Divider,
  IconTile,
  ListRow,
  ScreenHeader,
  SectionTitle,
  SegmentedControl,
  Sheet,
  Switch,
  Text,
  useToast,
} from '@/components/ui';

type Prefs = Pick<
  SettingsShape,
  'appLockEnabled' | 'appLockTimeoutMs' | 'budgetAlertsEnabled' | 'billRemindersEnabled' | 'captureMode' | 'recapEnabled' | 'lastBackupAt' | 'overallBudgetPaise'
>;

async function fetchSettings() {
  const [budgets, categories, members, recurring, owed, prefs, permission, lock] = await Promise.all([
    budgetService.getMonthlyBudgets(),
    categoryService.getAll(),
    memberService.getAll(),
    recurringService.listRecurring(),
    splitService.getTotalOwed(),
    getSettings([
      'appLockEnabled',
      'appLockTimeoutMs',
      'budgetAlertsEnabled',
      'billRemindersEnabled',
      'captureMode',
      'recapEnabled',
      'lastBackupAt',
      'overallBudgetPaise',
    ]),
    alertsService.getPermission(),
    getLockSupport(),
  ]);
  return {
    counts: {
      budgets: budgets.length + (prefs.overallBudgetPaise > 0 ? 1 : 0),
      categories: categories.length,
      members: members.length,
      recurring: recurring.length,
    },
    owed,
    prefs: prefs as Prefs,
    permission,
    lock: lock as LockSupport,
  };
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TIMEOUTS: { value: string; label: string }[] = [
  { value: '0', label: 'Immediately' },
  { value: '60000', label: '1 minute' },
  { value: '300000', label: '5 minutes' },
];

export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { data, reload } = useScreenData(fetchSettings);
  const [capture, setCapture] = useState<CaptureStatus | null>(null);
  const [busy, setBusy] = useState<'backup' | 'restore' | 'csv' | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);

  // The SMS permission can change in system settings; re-read
  // whenever the app comes back to the foreground.
  const checkCapture = useCallback(() => {
    getCaptureStatus()
      .then(setCapture)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    checkCapture();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        checkCapture();
        reload();
      }
    });
    return () => sub.remove();
  }, [checkCapture, reload]);

  const updatePref = async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    await setSetting(key, value as SettingsShape[K]);
    reload();
  };

  const toggleLock = async (on: boolean) => {
    if (!data) return;
    if (on && !data.lock.available) {
      Alert.alert('Set up a screen lock first', 'Add a fingerprint, face unlock or PIN in your phone settings, then turn this on.');
      return;
    }
    await updatePref('appLockEnabled', on);
    haptic.success();
    toast.show(on ? 'App lock is on' : 'App lock is off');
  };

  const toggleAlert = async (key: 'budgetAlertsEnabled' | 'billRemindersEnabled' | 'recapEnabled', on: boolean) => {
    if (on && data?.permission !== 'granted') {
      suppressLock(30_000);
      const granted = await alertsService.requestPermission();
      if (!granted) {
        Alert.alert('Notifications are blocked', 'Allow notifications for Money Manager in your phone settings to get alerts.');
        return;
      }
    }
    await updatePref(key, on);
    void alertsService.refreshScheduledNotifications();
  };

  const enableNotifications = async () => {
    suppressLock(30_000);
    const granted = await alertsService.requestPermission();
    reload();
    if (granted) {
      haptic.success();
      toast.show('Notifications are on');
    } else {
      Alert.alert('Notifications are blocked', 'Allow notifications for Money Manager in your phone settings to get alerts.');
    }
  };

  const backup = async () => {
    setBusy('backup');
    try {
      suppressLock();
      const summary = await backupService.exportBackup();
      reload();
      toast.show(`Backup ready · ${pluralize(summary.transactions, 'transaction')}`);
    } catch (error) {
      console.error('[Settings] backup failed:', error);
      toast.show('Backup failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const pickRestore = async () => {
    setBusy('restore');
    try {
      suppressLock();
      const file = await backupService.pickBackup();
      if (file) setPendingRestore(file);
    } catch (error) {
      Alert.alert("Couldn't read that file", error instanceof Error ? error.message : 'Try another backup file.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!pendingRestore) return;
    setBusy('restore');
    try {
      const summary = await backupService.restoreBackup(pendingRestore);
      setPendingRestore(null);
      dataEvents.emit();
      reload();
      haptic.success();
      toast.show(`Restored ${pluralize(summary.transactions, 'transaction')}`);
    } catch (error) {
      console.error('[Settings] restore failed:', error);
      toast.show('Restore failed. Your data was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      suppressLock();
      const count = await backupService.exportCsvFile();
      if (count === 0) toast.show('Nothing to export yet', 'info');
    } catch (error) {
      console.error('[Settings] export failed:', error);
      toast.show('Export failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Delete all transactions?',
      'This permanently removes every transaction, budget, split, recurring payment and learned merchant from this device. Categories and people are kept. Make a backup first if you might want them back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            ledgerService
              .clearAllData()
              .then(() => {
                dataEvents.emit();
                reload();
                haptic.warning();
                toast.show('All transactions deleted');
              })
              .catch((error) => {
                console.error('[Settings] clear failed:', error);
                toast.show('Could not delete data', 'error');
              });
          },
        },
      ]
    );
  };

  const simulate = () => {
    services.transaction
      .simulateUpiSms()
      .then((result) => {
        if (!result) {
          Alert.alert('Not parsed', 'The sample bank SMS was not recognised as a UPI payment.');
          return;
        }
        Alert.alert(
          'Parser result',
          `Direction: ${result.direction}
Amount: ₹${(result.amountPaise / 100).toFixed(2)}
Merchant: ${result.merchant ?? '—'}
Reference: ${result.transactionReference ?? '—'}`
        );
      })
      .catch(() => Alert.alert('Unavailable', 'The native SMS module is not available on this platform.'));
  };

  const loadSamples = () => {
    seedDevelopmentData()
      .then(() => {
        dataEvents.emit();
        toast.show('Sample data loaded');
      })
      .catch(() => toast.show('Could not load samples', 'error'));
  };

  const showStats = () => {
    services.notification
      .getParsingStats()
      .then((s) => Alert.alert('Capture stats', `Events: ${s.total}\nBy app: ${JSON.stringify(s.bySource)}\nBy status: ${JSON.stringify(s.byStatus)}`))
      .catch(() => Alert.alert('Unavailable', 'The native SMS module is not available.'));
  };

  const replayOnboarding = async () => {
    await setSetting('onboardingDone', false);
    session.needsOnboarding = true;
    router.replace('/onboarding');
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const prefs = data?.prefs;
  const notificationsOn = data?.permission === 'granted';
  const restoreSummary = pendingRestore ? summarize(pendingRestore) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader large title="Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {capture ? <View style={{ marginTop: space.md }}><CaptureStatusCard status={capture} onChanged={checkCapture} /></View> : null}

        <SectionTitle title="Organize" style={{ marginTop: space.lg }} />
        <Card padded={false} style={styles.group}>
          <ListRow
            title="Budgets"
            subtitle="Monthly limits and alerts"
            left={<IconTile icon="target" />}
            value={data ? (data.counts.budgets ? `${data.counts.budgets} active` : 'None') : undefined}
            chevron
            onPress={() => router.push('/budgets')}
          />
          <Divider />
          <ListRow
            title="Recurring payments"
            subtitle="Subscriptions, rent and bills"
            left={<IconTile icon="repeat" />}
            value={data ? (data.counts.recurring ? String(data.counts.recurring) : 'None') : undefined}
            chevron
            onPress={() => router.push('/recurring')}
          />
          <Divider />
          <ListRow
            title="People & splits"
            subtitle={data && data.owed > 0 ? `${formatINR(data.owed, { decimals: 'never' })} owed to you` : 'Who an expense was for, split bills'}
            subtitleColor={data && data.owed > 0 ? colors.positive : undefined}
            left={<IconTile icon="users" />}
            value={data ? String(data.counts.members) : undefined}
            chevron
            onPress={() => router.push('/members')}
          />
          <Divider />
          <ListRow
            title="Categories"
            subtitle="Expense and income categories"
            left={<IconTile icon="shapes" />}
            value={data ? String(data.counts.categories) : undefined}
            chevron
            onPress={() => router.push('/categories')}
          />
          <Divider />
          <ListRow
            title="Monthly recap"
            subtitle="Last month at a glance"
            left={<IconTile icon="sparkles" />}
            chevron
            onPress={() => router.push('/recap')}
          />
        </Card>

        <SectionTitle title="Appearance" />
        <Card style={styles.group}>
          <Text variant="bodyStrong">Theme</Text>
          <Text variant="caption" style={{ marginTop: 2, marginBottom: space.sm }}>
            System follows your phone's dark mode setting.
          </Text>
          <SegmentedControl options={THEMES} value={preference} onChange={setPreference} />
        </Card>

        <SectionTitle title="Privacy & security" />
        <Card padded={false} style={styles.group}>
          <ListRow
            title="App lock"
            subtitle={
              data
                ? data.lock.available
                  ? `Unlock with ${data.lock.label.toLowerCase()}`
                  : 'Needs a screen lock on your phone'
                : undefined
            }
            left={<IconTile icon="lock" />}
            right={<Switch value={!!prefs?.appLockEnabled} onValueChange={(v) => void toggleLock(v)} disabled={!data} />}
          />
          {prefs?.appLockEnabled ? (
            <View style={styles.inset}>
              <Text variant="label" style={{ marginBottom: space.xs }}>
                Lock again after leaving the app
              </Text>
              <SegmentedControl
                options={TIMEOUTS}
                value={String(prefs.appLockTimeoutMs)}
                onChange={(v) => void updatePref('appLockTimeoutMs', Number(v) as LockTimeout)}
              />
            </View>
          ) : null}
        </Card>

        <SectionTitle title="Notifications" />
        <Card padded={false} style={styles.group}>
          {!notificationsOn && data ? (
            <>
              <View style={styles.inset}>
                <Text variant="label">Turn on notifications for budget alerts, bill reminders and your monthly recap.</Text>
                <Button title="Turn on notifications" icon="bell" fullWidth onPress={() => void enableNotifications()} style={{ marginTop: space.sm }} />
              </View>
              <Divider />
            </>
          ) : null}
          <ListRow
            title="Budget alerts"
            subtitle="At 80% and 100% of a budget"
            left={<IconTile icon="target" />}
            right={<Switch value={!!prefs?.budgetAlertsEnabled && notificationsOn} onValueChange={(v) => void toggleAlert('budgetAlertsEnabled', v)} disabled={!data} />}
          />
          <Divider />
          <ListRow
            title="Bill reminders"
            subtitle="The day before a recurring payment"
            left={<IconTile icon="repeat" />}
            right={<Switch value={!!prefs?.billRemindersEnabled && notificationsOn} onValueChange={(v) => void toggleAlert('billRemindersEnabled', v)} disabled={!data} />}
          />
          <Divider />
          <ListRow
            title="Monthly recap"
            subtitle="On the 1st of every month"
            left={<IconTile icon="sparkles" />}
            right={<Switch value={!!prefs?.recapEnabled && notificationsOn} onValueChange={(v) => void toggleAlert('recapEnabled', v)} disabled={!data} />}
          />
        </Card>

        {Platform.OS === 'android' ? (
          <>
            <SectionTitle title="Auto-capture" />
            <Card padded={false} style={styles.group}>
              <ListRow
                title="Auto-capture mode"
                subtitle={prefs?.captureMode === 'auto' ? 'SMS stored silently, review from History tab' : 'Opens review form instantly on payment SMS'}
                left={<IconTile icon="inbox" />}
              />
              <View style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>
                <SegmentedControl
                  options={[
                    { value: 'instant', label: 'Instant' },
                    { value: 'auto', label: 'Auto' },
                  ]}
                  value={prefs?.captureMode ?? 'instant'}
                  onChange={(value) => {
                    void updatePref('captureMode', value as 'instant' | 'auto');
                    notificationDetectionService.setCaptureMode(value);
                  }}
                />
              </View>
            </Card>
          </>
        ) : null}

        <SectionTitle title="Backup & data" />
        <Card padded={false} style={styles.group}>
          <ListRow
            title={busy === 'backup' ? 'Preparing backup…' : 'Back up now'}
            subtitle={
              prefs?.lastBackupAt
                ? `Last backup ${timeAgo(prefs.lastBackupAt)}`
                : 'Save a backup file to Drive, Files or email'
            }
            left={<IconTile icon="cloudUpload" />}
            chevron
            disabled={busy !== null}
            onPress={() => void backup()}
          />
          <Divider />
          <ListRow
            title={busy === 'restore' ? 'Opening…' : 'Restore from backup'}
            subtitle="Replace this phone's data with a backup file"
            left={<IconTile icon="download" />}
            chevron
            disabled={busy !== null}
            onPress={() => void pickRestore()}
          />
          <Divider />
          <ListRow
            title={busy === 'csv' ? 'Preparing export…' : 'Export as CSV'}
            subtitle="Open in Sheets or Excel"
            left={<IconTile icon="fileSpreadsheet" />}
            chevron
            disabled={busy !== null}
            onPress={() => void exportCsv()}
          />
        </Card>
        <Button title="Delete all transactions" icon="trash" variant="dangerSoft" fullWidth onPress={confirmClear} style={{ marginTop: space.sm }} />

        {Platform.OS === 'android' ? (
          <>
            <SectionTitle title="Home screen widget" />
            <Card style={styles.group}>
              <Text variant="bodyStrong">{capture?.health?.widgetCount ? 'Widget added' : 'Add the widget'}</Text>
              <Text variant="caption" style={{ marginTop: 2 }}>
                {capture?.health?.widgetCount
                  ? "Shows today's spending and payments to review, with a quick add button."
                  : 'Long-press your home screen, tap Widgets and pick Money Manager to see today\'s spending at a glance.'}
              </Text>
            </Card>
          </>
        ) : null}

        {__DEV__ ? (
          <>
            <SectionTitle title="Developer" />
            <Card padded={false} style={styles.group}>
              <ListRow
                title="Load sample data"
                subtitle="Adds clearly marked sample expenses"
                left={<IconTile icon="database" />}
                onPress={loadSamples}
              />
              <Divider />
              <ListRow
                title="Test the UPI parser"
                subtitle="Parse a sample bank SMS"
                left={<IconTile icon="flask" />}
                onPress={simulate}
              />
              <Divider />
              <ListRow title="Capture statistics" left={<IconTile icon="chart" />} onPress={showStats} />
              <Divider />
              <ListRow title="Show onboarding again" left={<IconTile icon="sparkles" />} onPress={() => void replayOnboarding()} />
            </Card>
          </>
        ) : null}

        <View style={styles.footer}>
          <Text variant="caption" align="center">
            Money Manager {version}
          </Text>
          <Text variant="caption" align="center" style={{ marginTop: 2 }}>
            Your data stays on this device unless you export or back it up.
          </Text>
        </View>
      </ScrollView>

      <Sheet
        visible={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title="Restore this backup?"
        footer={
          <View style={{ gap: space.xs }}>
            <Button title="Replace my data" variant="danger" size="lg" fullWidth loading={busy === 'restore'} onPress={() => void restore()} />
            <Button title="Cancel" variant="ghost" fullWidth onPress={() => setPendingRestore(null)} />
          </View>
        }
      >
        {restoreSummary ? (
          <>
            <Text variant="body">
              Made on {formatFullDate(restoreSummary.exportedAt)}. It has {pluralize(restoreSummary.transactions, 'transaction')},{' '}
              {pluralize(restoreSummary.categories, 'category', 'categories')}, {pluralize(restoreSummary.budgets, 'budget')} and{' '}
              {pluralize(restoreSummary.recurring, 'recurring payment')}.
            </Text>
            <Text variant="label" color={colors.negative} style={{ marginTop: space.md }}>
              Everything currently on this phone will be replaced. Back up first if you want to keep it.
            </Text>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
  },
  sectionTitle: {
    marginTop: space.xxl,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  group: {
    overflow: 'hidden',
  },
  inset: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    paddingTop: space.xs,
  },
  footer: {
    marginTop: space.xxl,
  },
}));
