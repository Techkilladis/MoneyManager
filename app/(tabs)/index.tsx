import React, { useCallback } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, space, tint } from '@/design/tokens';
import { ledgerService, services } from '@/services';
import { useScreenData } from '@/hooks/useScreenData';
import { HomeSummary } from '@/services/ledger';
import { FormattedTransaction } from '@/domain/transaction';
import { formatINR, greeting, pluralize, splitINR } from '@/utils/format';
import { StackedBar } from '@/components/Charts';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Button,
  Card,
  CategoryAvatar,
  Divider,
  EmptyState,
  ErrorView,
  Icon,
  IconTile,
  LoadingView,
  ProgressBar,
  ScreenHeader,
  SectionTitle,
  Text,
  UncategorizedAvatar,
} from '@/components/ui';

type HomeData = HomeSummary & { captureEnabled: boolean | null };

async function fetchHome(): Promise<HomeData> {
  const [summary, captureEnabled] = await Promise.all([
    ledgerService.getHomeSummary(),
    Platform.OS === 'android'
      ? services.notification.isNotificationAccessEnabled().catch(() => null)
      : Promise.resolve(null),
  ]);
  return { ...summary, captureEnabled };
}

export default function HomeScreen() {
  const { data, error, refreshing, refresh, reload } = useScreenData(fetchHome);
  const openTx = useCallback((tx: FormattedTransaction) => router.push(`/transaction/${tx.id}`), []);

  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <LoadingView />;

  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const showCaptureNudge = data.captureEnabled === false;

  return (
    <View style={styles.screen}>
      <ScreenHeader large eyebrow={greeting()} title="Your spending" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} tintColor={colors.brand} />}
      >
        <HeroCard data={data} monthName={monthName} />

        {data.pending.length > 0 ? <PendingCard data={data} /> : null}

        {showCaptureNudge ? (
          <Card style={styles.block} onPress={() => router.push('/settings')}>
            <View style={styles.nudge}>
              <IconTile icon="zap" color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Turn on auto-capture</Text>
                <Text variant="caption" style={{ marginTop: 2 }}>
                  Log UPI payments from Google Pay, PhonePe, Paytm and more automatically.
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textDisabled} />
            </View>
          </Card>
        ) : null}

        {!data.hasAnyTransactions ? (
          <Card style={styles.block}>
            <EmptyState
              compact
              icon="wallet"
              title="Start tracking your money"
              message="Add an expense now, or let auto-capture log your UPI payments as they happen."
              actionLabel="Add first expense"
              onAction={() => router.push('/transactions/new')}
            />
          </Card>
        ) : (
          <>
            {data.topCategories.length > 0 ? <CategoryCard data={data} monthName={monthName} /> : null}

            <View style={styles.block}>
              <SectionTitle title="Recent" action="See all" onAction={() => router.push('/transactions')} />
              <Card padded={false} style={styles.listCard}>
                {data.recent.length === 0 ? (
                  <EmptyState compact icon="receipt" title="No confirmed expenses yet" message="Review your pending payments to see them here." />
                ) : (
                  data.recent.map((tx, i) => (
                    <View key={tx.id}>
                      {i > 0 ? <Divider inset={72} /> : null}
                      <TransactionRow tx={tx} onPress={openTx} showDate />
                    </View>
                  ))
                )}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function HeroCard({ data, monthName }: { data: HomeData; monthName: string }) {
  const [whole, fraction] = splitINR(data.monthTotal);
  const base = data.lastMonthToDate;
  const change = base > 0 ? (data.monthTotal - base) / base : null;
  const up = change !== null && change > 0;

  return (
    <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Text variant="overline" color={colors.textOnDarkMuted}>
        Spent in {monthName}
      </Text>
      <View style={styles.heroAmount}>
        <Text variant="hero" color={colors.textOnDark} numeric style={{ fontSize: 40, lineHeight: 46 }}>
          {whole}
        </Text>
        <Text variant="heading" color={colors.textOnDarkSubtle} numeric style={{ marginBottom: 5 }}>
          {fraction}
        </Text>
      </View>

      <View style={styles.deltaRow}>
        {change !== null && Math.abs(change) >= 0.005 ? (
          <View style={[styles.deltaPill, { backgroundColor: up ? 'rgba(255,107,107,0.22)' : 'rgba(52,211,153,0.22)' }]}>
            <Icon name={up ? 'trendingUp' : 'trendingDown'} size={14} color={up ? '#FFB4B4' : '#A7F3D0'} />
            <Text variant="caption" color={colors.textOnDark}>
              {Math.round(Math.abs(change) * 100)}% {up ? 'more' : 'less'} than last month so far
            </Text>
          </View>
        ) : (
          <Text variant="caption" color={colors.textOnDarkMuted}>
            {data.monthCount > 0 ? `${pluralize(data.monthCount, 'expense')} this month` : 'No spending yet this month'}
          </Text>
        )}
      </View>

      {data.budget ? (
        <View style={styles.heroBudget}>
          <View style={styles.heroBudgetText}>
            <Text variant="caption" color={colors.textOnDarkMuted}>
              Budget {formatINR(data.budget.spent, { decimals: 'never' })} of {formatINR(data.budget.limit, { decimals: 'never' })}
            </Text>
            <Text variant="caption" color={data.budget.spent > data.budget.limit ? '#FFB4B4' : colors.textOnDark}>
              {data.budget.spent > data.budget.limit
                ? `${formatINR(data.budget.spent - data.budget.limit, { decimals: 'never' })} over`
                : `${formatINR(data.budget.limit - data.budget.spent, { decimals: 'never' })} left`}
            </Text>
          </View>
          <ProgressBar
            value={data.budget.limit > 0 ? data.budget.spent / data.budget.limit : 0}
            color={data.budget.spent > data.budget.limit ? '#FF8A8A' : '#FFFFFF'}
            track="rgba(255,255,255,0.18)"
            height={6}
          />
        </View>
      ) : null}

      <View style={styles.heroStats}>
        <HeroStat label="Today" value={formatINR(data.todayTotal, { decimals: 'never' })} />
        <View style={styles.heroDivider} />
        <HeroStat label="This week" value={formatINR(data.weekTotal, { decimals: 'never' })} />
        <View style={styles.heroDivider} />
        <HeroStat label="Daily avg" value={formatINR(data.dailyAverage, { decimals: 'never' })} />
      </View>
    </LinearGradient>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" color={colors.textOnDarkSubtle}>
        {label}
      </Text>
      <Text variant="bodyStrong" color={colors.textOnDark} numeric numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function PendingCard({ data }: { data: HomeData }) {
  const count = data.pending.length;
  const preview = data.pending.slice(0, 3).map((t) => t.merchant).join(', ');
  return (
    <Card style={[styles.block, styles.pendingCard]} flat>
      <View style={styles.pendingTop}>
        <View style={styles.pendingIcon}>
          <Icon name="zap" size={20} color={colors.textOnBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">
            {count === 1 ? '1 payment to review' : `${count} payments to review`}
          </Text>
          <Text variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>
            {formatINR(data.pendingTotal)} detected · {preview}
          </Text>
        </View>
      </View>
      <Button title={count === 1 ? 'Review payment' : 'Review payments'} icon="check" fullWidth onPress={() => router.push('/quick-capture')} />
    </Card>
  );
}

function CategoryCard({ data, monthName }: { data: HomeData; monthName: string }) {
  const top = data.topCategories.slice(0, 4);
  return (
    <View style={styles.block}>
      <SectionTitle title={`${monthName} by category`} action="Insights" onAction={() => router.push('/analytics')} />
      <Card>
        <StackedBar slices={data.topCategories.map((c) => ({ key: c.categoryId ?? 'none', value: c.totalPaise, color: c.color ?? colors.textTertiary }))} />
        <View style={{ marginTop: space.sm }}>
          {top.map((c) => (
            <View key={c.categoryId ?? 'none'} style={styles.catRow}>
              {c.categoryId ? <CategoryAvatar icon={c.icon} color={c.color} size={36} /> : <UncategorizedAvatar size={36} />}
              <View style={{ flex: 1 }}>
                <Text variant="labelStrong">{c.name}</Text>
                <Text variant="caption">{pluralize(c.count, 'expense')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="labelStrong" numeric>
                  {formatINR(c.totalPaise, { decimals: 'never' })}
                </Text>
                <Text variant="caption" numeric>
                  {Math.round(c.share * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
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
  block: {
    marginTop: space.xl,
  },
  listCard: {
    overflow: 'hidden',
    paddingVertical: space.xxs,
  },
  hero: {
    borderRadius: radius.xxl,
    padding: space.xl,
  },
  heroAmount: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: space.xs,
  },
  deltaRow: {
    flexDirection: 'row',
    marginTop: space.xs,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  heroBudget: {
    marginTop: space.lg,
    gap: space.xs,
  },
  heroBudgetText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: space.sm,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pendingCard: {
    backgroundColor: tint(colors.brand, 0.08),
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    gap: space.md,
  },
  pendingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
});
