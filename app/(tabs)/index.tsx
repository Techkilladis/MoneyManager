import React, { useCallback } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { ledgerService, recapService, recurringService, splitService } from '@/services';
import { useScreenData } from '@/hooks/useScreenData';
import { HomeSummary } from '@/services/ledger';
import { CaptureStatus, getCaptureStatus } from '@/services/captureHealth';
import { dismissRecapCard, MonthlyRecap, recapHeadline } from '@/services/recap';
import { RecurringView } from '@/services/recurring';
import { FormattedTransaction } from '@/domain/transaction';
import { formatINR, greeting, pluralize, splitINR } from '@/utils/format';
import { CaptureStatusCard } from '@/components/CaptureStatusCard';
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
  IconButton,
  IconName,
  KeyFigure,
  LoadingView,
  ProgressBar,
  ScreenHeader,
  SectionTitle,
  StatusChip,
  Text,
  UncategorizedAvatar,
} from '@/components/ui';

type HomeData = HomeSummary & {
  capture: CaptureStatus | null;
  recap: MonthlyRecap | null;
  upcoming: RecurringView[];
  owed: number;
};

async function fetchHome(): Promise<HomeData> {
  const [summary, capture, recap, upcoming, owed] = await Promise.all([
    ledgerService.getHomeSummary().catch((err) => {
      console.error('[Home] getHomeSummary failed:', err);
      throw err;
    }),
    getCaptureStatus().catch(() => null),
    recapService.getRecapCard().catch(() => null),
    recurringService.getUpcoming(7).catch(() => []),
    splitService.getTotalOwed().catch(() => 0),
  ]);
  return { ...summary, capture, recap, upcoming: upcoming.filter((r) => !r.paidThisPeriod), owed };
}

function dueLabel(days: number): string {
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data, error, refreshing, refresh, reload } = useScreenData(fetchHome);
  const openTx = useCallback((tx: FormattedTransaction) => router.push(`/transaction/${tx.id}`), []);

  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <LoadingView />;

  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });

  return (
    <View style={styles.screen}>
      {/* OTA Test Button */}
      <Pressable
        onPress={async () => {
          try {
            Alert.alert('OTA Reload', 'Triggering OTA reload...');
            await Updates.reloadAsync();
          } catch (error) {
            Alert.alert('OTA Reload Failed', String(error));
          }
        }}
        style={({ pressed }) => [
          styles.otaTestButton,
          { backgroundColor: colors.brand },
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Test OTA reload"
      >
        <Icon name="refresh" size={16} color={colors.background} />
        <Text style={styles.otaTestText} color={colors.background} variant="labelStrong">
          Test OTA
        </Text>
      </Pressable>

      <ScreenHeader
        large
        eyebrow={greeting()}
        title={monthName}
        right={
          <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
            <IconButton icon="mic" color={colors.textSecondary} accessibilityLabel="Add by voice" onPress={() => router.push('/voice-capture')} />
            <IconButton icon="search" color={colors.textSecondary} accessibilityLabel="Search history" onPress={() => router.push('/transactions')} />
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} tintColor={colors.brand} />}
      >
        <Summary data={data} />

        {data.capture ? (
          <View style={data.capture.state === 'off' || data.capture.missed ? styles.section : null}>
            <CaptureStatusCard status={data.capture} compact onChanged={reload} />
          </View>
        ) : null}

        <ReviewQueue data={data} onChanged={reload} />
        <NeedsYou data={data} onChanged={reload} />

        {!data.hasAnyTransactions ? (
          <Card style={styles.section}>
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
            {data.topCategories.length > 0 ? <WhereItWent data={data} /> : null}

            <View style={styles.section}>
              <SectionTitle title="Recent" action="See all" onAction={() => router.push('/transactions')} />
              <Card padded={false}>
                {data.recent.length === 0 ? (
                  <EmptyState compact icon="receipt" title="No confirmed expenses yet" message="Review your pending payments to see them here." />
                ) : (
                  data.recent.map((tx, i) => (
                    <View key={tx.id}>
                      {i > 0 ? <Divider /> : null}
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

/** The month's spend on the paper, then budget progress and quick stats. */
function Summary({ data }: { data: HomeData }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [whole, fraction] = splitINR(data.monthTotal);
  const base = data.lastMonthToDate;
  const change = base > 0 ? (data.monthTotal - base) / base : null;
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const budget = data.budget;
  const over = budget ? budget.spent > budget.limit : false;

  return (
    <View style={styles.summary}>
      <KeyFigure label="Spent this month" value={whole} fraction={fraction}>
        <View style={styles.deltaRow}>
          {change !== null && Math.abs(change) >= 0.005 ? (
            <>
              <StatusChip
                tone={change > 0 ? 'up' : 'down'}
                icon={change > 0 ? 'trendingUp' : 'trendingDown'}
                label={`${Math.round(Math.abs(change) * 100)}%`}
              />
              <Text variant="caption">vs. last month so far</Text>
            </>
          ) : (
            <Text variant="caption">
              {data.monthCount > 0 ? `${pluralize(data.monthCount, 'expense')} this month` : 'No spending yet this month'}
            </Text>
          )}
        </View>
      </KeyFigure>

      <Card style={styles.section}>
        {budget ? (
          <>
            <View style={styles.between}>
              <Text variant="label">{budget.overall ? 'Monthly budget' : 'Budgets'}</Text>
              <Text variant="caption" numeric>
                {pluralize(daysLeft, 'day')} left
              </Text>
            </View>
            <View style={{ marginTop: space.sm }}>
              <ProgressBar
                value={budget.limit > 0 ? budget.spent / budget.limit : 0}
                color={over ? colors.negative : budget.spent / budget.limit >= 0.9 ? colors.warning : colors.brand}
              />
            </View>
            <View style={[styles.between, { marginTop: space.sm }]}>
              <Text variant="bodyStrong" numeric color={over ? colors.negative : colors.text}>
                {formatINR(Math.abs(budget.limit - budget.spent), { decimals: 'never' })}
                <Text variant="body" color={over ? colors.negative : colors.textSecondary}>
                  {over ? ' over' : ' left'}
                </Text>
              </Text>
              <Text variant="caption" numeric>
                of {formatINR(budget.limit, { decimals: 'never' })}
              </Text>
            </View>
            <Divider style={{ marginVertical: space.md }} />
          </>
        ) : null}
        <View style={styles.stats}>
          <Stat label="Today" value={formatINR(data.todayTotal, { decimals: 'never' })} />
          <View style={styles.statDivider} />
          <Stat label="This week" value={formatINR(data.weekTotal, { decimals: 'never' })} />
          <View style={styles.statDivider} />
          {data.monthIncome > 0 ? (
            <Stat label="Earned" value={formatINR(data.monthIncome, { decimals: 'never' })} color={colors.positive} />
          ) : (
            <Stat label="Daily avg" value={formatINR(data.dailyAverage, { decimals: 'never' })} />
          )}
        </View>
        {!budget ? (
          <Pressable onPress={() => router.push('/budgets')} hitSlop={8} style={{ marginTop: space.md }} accessibilityRole="button">
            <Text variant="labelStrong" color={colors.brand}>
              Set a monthly budget
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption">{label}</Text>
      <Text variant="bodyStrong" numeric color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ marginTop: space.xxs }}>
        {value}
      </Text>
    </View>
  );
}

/** Review queue — the only urgent action, set apart on a moss wash. */
function ReviewQueue({ data, onChanged }: { data: HomeData; onChanged: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const count = data.pending.length;
  if (count === 0) return null;

  const preview = data.pending.slice(0, 3).map((t) => t.merchant).join(', ');
  return (
    <View style={styles.section}>
      <View style={styles.reviewRow}>
        <View style={styles.reviewIcon}>
          <Icon name="zap" size={20} color={colors.textOnBrand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong">{count === 1 ? '1 payment to review' : `${count} payments to review`}</Text>
          <Text variant="label" numeric numberOfLines={1}>
            {formatINR(data.pendingTotal, { decimals: 'never' })} · {preview}
          </Text>
        </View>
        <Button title="Review" size="sm" onPress={() => router.push('/quick-capture')} />
      </View>
    </View>
  );
}

/** Upcoming bills, owed money, recap nudge, and the voice-capture shortcut. */
function NeedsYou({ data, onChanged }: { data: HomeData; onChanged: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bills = data.upcoming.slice(0, 3);
  const rows: React.ReactNode[] = [];

  for (const r of bills) {
    const soon = r.daysUntilDue <= 1;
    rows.push(
      <AttentionRow
        key={r.id}
        left={r.category ? <CategoryAvatar icon={r.category.icon} color={r.category.color} /> : <UncategorizedAvatar />}
        title={r.name}
        meta={dueLabel(r.daysUntilDue)}
        metaColor={soon ? colors.warning : undefined}
        metaStrong={soon}
        value={formatINR(r.amountPaise, { decimals: 'never' })}
        onPress={() => router.push('/recurring')}
      />
    );
  }

  if (data.owed > 0) {
    rows.push(
      <AttentionRow
        key="owed"
        left={<Badge icon="coins" color={colors.positive} background={colors.positiveSoft} />}
        title="Owed to you"
        meta="From split expenses"
        value={formatINR(data.owed, { decimals: 'never' })}
        valueColor={colors.positive}
        chevron
        onPress={() => router.push('/members')}
      />
    );
  }

  const recap = data.recap;
  if (recap) {
    rows.push(
      <AttentionRow
        key="recap"
        left={<Badge icon="sparkles" color={colors.warning} background={colors.warningSoft} />}
        title={`${recap.monthName} recap is ready`}
        meta={`${formatINR(recap.spent, { decimals: 'never' })} spent · ${recapHeadline(recap)}`}
        onPress={() => router.push(`/recap?month=${recap.monthKey}`)}
        trailing={
          <IconButton
            icon="x"
            size={32}
            background="transparent"
            color={colors.textTertiary}
            accessibilityLabel="Dismiss recap"
            onPress={() => void dismissRecapCard(recap.monthKey).then(onChanged)}
          />
        }
      />
    );
  }

  // Voice / text transaction entry
  rows.push(
    <AttentionRow
      key="voice"
      left={<Badge icon="mic" color={colors.brand} background={colors.brandSoft} />}
      title="Add by voice or text"
      meta={'"paid ₹200 for swiggy" or "lunch 300"'}
      chevron
      onPress={() => router.push('/voice-capture')}
    />
  );

  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionTitle
        title="Needs you"
        action={bills.length > 0 ? 'All bills' : undefined}
        onAction={bills.length > 0 ? () => router.push('/recurring') : undefined}
      />
      <Card padded={false}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {row}
          </View>
        ))}
      </Card>
    </View>
  );
}

function Badge({ icon, color, background }: { icon: IconName; color: string; background: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={color} />
    </View>
  );
}

function AttentionRow({
  left,
  title,
  meta,
  metaColor,
  metaStrong,
  value,
  valueColor,
  chevron,
  trailing,
  onPress,
}: {
  left: React.ReactNode;
  title: string;
  meta: string;
  metaColor?: string;
  metaStrong?: boolean;
  value?: string;
  valueColor?: string;
  chevron?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        <Text variant={metaStrong ? 'labelStrong' : 'caption'} color={metaColor} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {value ? (
        <Text variant="bodyStrong" numeric color={valueColor}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <Icon name="chevronRight" size={18} color={colors.textTertiary} /> : null}
    </Pressable>
  );
}

function WhereItWent({ data }: { data: HomeData }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const top = data.topCategories.slice(0, 4);
  return (
    <View style={styles.section}>
      <SectionTitle title="Where it went" action="Insights" onAction={() => router.push('/analytics')} />
      <Card>
        <StackedBar slices={data.topCategories.map((c) => ({ key: c.categoryId ?? 'none', value: c.totalPaise, color: c.color ?? colors.textTertiary }))} />
        <View style={{ marginTop: space.md, gap: space.sm }}>
          {top.map((c) => (
            <View key={c.categoryId ?? 'none'} style={styles.catRow}>
              {c.categoryId ? <CategoryAvatar icon={c.icon} color={c.color} size={36} /> : <UncategorizedAvatar size={36} />}
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                {c.name}
              </Text>
              <Text variant="caption" numeric style={styles.pct}>
                {Math.round(c.share * 100)}%
              </Text>
              <Text variant="bodyStrong" numeric style={styles.catAmount}>
                {formatINR(c.totalPaise, { decimals: 'never' })}
              </Text>
            </View>
          ))}
        </View>
      </Card>
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
  section: {
    marginTop: space.xxl,
  },
  summary: {
    paddingTop: space.xl,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.md,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.brandSoft,
  },
  reviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pct: {
    width: 40,
    textAlign: 'right',
  },
  catAmount: {
    minWidth: 80,
    textAlign: 'right',
  },
  otaTestButton: {
    position: 'absolute',
    bottom: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  otaTestText: {
    marginLeft: 4,
  },
}));
