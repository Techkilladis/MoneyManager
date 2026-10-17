import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { colors, radius, space } from '@/design/tokens';
import { budgetService, categoryService, ledgerService, memberService, services } from '@/services';
import { dataEvents } from '@/services/events';
import { seedDevelopmentData } from '@/services/seedData';
import { useScreenData } from '@/hooks/useScreenData';
import { Button, Card, Divider, Icon, IconTile, ListRow, Text, ScreenHeader, useToast } from '@/components/ui';

async function fetchCounts() {
  const [budgets, categories, members] = await Promise.all([
    budgetService.getMonthlyBudgets(),
    categoryService.getAll(),
    memberService.getAll(),
  ]);
  return { budgets: budgets.length, categories: categories.length, members: members.length };
}

export default function SettingsScreen() {
  const toast = useToast();
  const { data: counts } = useScreenData(fetchCounts);
  const [access, setAccess] = useState<'checking' | 'on' | 'off' | 'unsupported'>(
    Platform.OS === 'android' ? 'checking' : 'unsupported'
  );
  const [exporting, setExporting] = useState(false);

  // Android's notification-access setting is the source of truth; re-read
  // it whenever the app returns from the system settings screen.
  const checkAccess = useCallback(() => {
    if (Platform.OS !== 'android') return;
    services.notification
      .isNotificationAccessEnabled()
      .then((enabled) => setAccess(enabled ? 'on' : 'off'))
      .catch(() => setAccess('off'));
  }, []);

  useEffect(() => {
    checkAccess();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkAccess();
    });
    return () => sub.remove();
  }, [checkAccess]);

  const openAccessSettings = async () => {
    try {
      await services.notification.openNotificationAccessSettings();
    } catch {
      await Linking.openSettings();
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { csv, count } = await ledgerService.exportTransactionsCsv();
      if (count === 0) {
        toast.show('Nothing to export yet', 'info');
        return;
      }
      await Share.share({ title: 'Money Manager export', message: csv });
    } catch (error) {
      console.error('[Settings] export failed:', error);
      toast.show('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Delete all expenses?',
      'This permanently removes every transaction, budget and learned merchant from this device. Categories and people are kept.',
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
                toast.show('All expenses deleted');
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
      .simulateUpiNotification()
      .then((result) => {
        if (!result) {
          Alert.alert('Not parsed', 'The sample notification did not match any UPI parser.');
          return;
        }
        Alert.alert(
          'Parser result',
          `Parser: ${result.parserName}\nAmount: ₹${(result.amountPaise / 100).toFixed(2)}\nMerchant: ${result.merchant ?? '—'}\nApp: ${result.sourceApp}\nConfidence: ${Math.round(result.confidence * 100)}%`
        );
      })
      .catch(() => Alert.alert('Unavailable', 'The native notification module is not available on this platform.'));
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
      .catch(() => Alert.alert('Unavailable', 'The native notification module is not available.'));
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.screen}>
      <ScreenHeader large title="Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Auto-capture */}
        <Card style={styles.capture}>
          <View style={styles.captureTop}>
            <View style={[styles.captureIcon, { backgroundColor: access === 'on' ? colors.positive : colors.brand }]}>
              <Icon name="zap" size={22} color={colors.textOnBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">UPI auto-capture</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: access === 'on' ? colors.positive : access === 'off' ? colors.warning : colors.textDisabled },
                  ]}
                />
                <Text variant="caption">
                  {access === 'on'
                    ? 'Active — payments are logged as they happen'
                    : access === 'off'
                      ? 'Off — notification access needed'
                      : access === 'checking'
                        ? 'Checking…'
                        : 'Available on Android'}
                </Text>
              </View>
            </View>
          </View>
          <Text variant="label" style={{ marginTop: space.sm }}>
            Reads payment notifications from Google Pay, PhonePe, Paytm, BHIM and other UPI apps on this device. Nothing is
            uploaded — every payment waits for your review.
          </Text>
          {access === 'off' || access === 'on' ? (
            <Button
              title={access === 'on' ? 'Manage notification access' : 'Turn on auto-capture'}
              variant={access === 'on' ? 'outline' : 'primary'}
              fullWidth
              onPress={openAccessSettings}
              style={{ marginTop: space.md }}
            />
          ) : null}
        </Card>

        <Text variant="overline" style={styles.groupLabel}>
          Organize
        </Text>
        <Card padded={false} style={styles.group}>
          <ListRow
            title="Budgets"
            subtitle="Monthly limits per category"
            left={<IconTile icon="target" color={colors.positive} />}
            value={counts ? (counts.budgets ? `${counts.budgets} active` : 'None') : undefined}
            chevron
            onPress={() => router.push('/budgets')}
          />
          <Divider inset={72} />
          <ListRow
            title="Categories"
            subtitle="Names, emoji and colours"
            left={<IconTile icon="tag" color="#F97316" />}
            value={counts ? String(counts.categories) : undefined}
            chevron
            onPress={() => router.push('/categories')}
          />
          <Divider inset={72} />
          <ListRow
            title="People"
            subtitle="Who an expense was for"
            left={<IconTile icon="users" color={colors.info} />}
            value={counts ? String(counts.members) : undefined}
            chevron
            onPress={() => router.push('/members')}
          />
        </Card>

        <Text variant="overline" style={styles.groupLabel}>
          Your data
        </Text>
        <Card padded={false} style={styles.group}>
          <ListRow
            title={exporting ? 'Preparing export…' : 'Export as CSV'}
            subtitle="Share to Sheets, Drive, email…"
            left={<IconTile icon="share" color={colors.brand} />}
            chevron
            disabled={exporting}
            onPress={exportCsv}
          />
          <Divider inset={72} />
          <ListRow
            title="Delete all expenses"
            subtitle="Erase transactions, budgets and history"
            left={<IconTile icon="trash" color={colors.negative} />}
            destructive
            onPress={confirmClear}
          />
        </Card>

        {__DEV__ ? (
          <>
            <Text variant="overline" style={styles.groupLabel}>
              Developer
            </Text>
            <Card padded={false} style={styles.group}>
              <ListRow
                title="Load sample data"
                subtitle="Adds clearly marked sample expenses"
                left={<IconTile icon="database" color="#A855F7" />}
                onPress={loadSamples}
              />
              <Divider inset={72} />
              <ListRow
                title="Test the UPI parser"
                subtitle="Parse a sample Google Pay notification"
                left={<IconTile icon="flask" color="#A855F7" />}
                onPress={simulate}
              />
              <Divider inset={72} />
              <ListRow
                title="Capture statistics"
                left={<IconTile icon="chart" color="#A855F7" />}
                onPress={showStats}
              />
            </Card>
          </>
        ) : null}

        <View style={styles.privacy}>
          <Icon name="lock" size={16} color={colors.textTertiary} />
          <Text variant="caption" align="center">
            Private by design. Your data lives only on this phone — no account, no cloud, no tracking.
          </Text>
        </View>
        <Text variant="caption" align="center" color={colors.textDisabled}>
          Money Manager {version}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
  },
  capture: {
    padding: space.lg,
  },
  captureTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  captureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupLabel: {
    marginTop: space.xl,
    marginBottom: space.xs,
    marginLeft: space.xxs,
  },
  group: {
    overflow: 'hidden',
  },
  privacy: {
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xxl,
    marginBottom: space.xs,
    paddingHorizontal: space.xl,
  },
});
