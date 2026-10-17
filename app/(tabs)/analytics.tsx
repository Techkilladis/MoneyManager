import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { analyticsService, budgetService, ledgerService } from '@/services';
import { useScreenData } from '@/hooks/useScreenData';
import type { CategoryShare } from '@/services/ledger';
import { weekBounds } from '@/services/ledger';
import { BarChart, BarDatum, Donut } from '@/components/Charts';
import { formatCompactINR, formatDayLabel, formatINR, pluralize, splitINR, startOfDay } from '@/utils/format';
import {
  Card,
  CategoryAvatar,
  EmptyState,
  ErrorView,
  Icon,
  IconButton,
  IconName,
  IconTile,
  LoadingView,
  MemberAvatar,
  ProgressBar,
  ScreenHeader,
  SectionTitle,
  SegmentedControl,
  Text,
  UncategorizedAvatar,
} from '@/components/ui';

type Mode = 'week' | 'month' | 'quarter' | 'year';

const MODES: { value: Mode; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: '3 Months' },
  { value: 'year', label: 'Year' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeFor(mode: Mode, offset: number): { start: number; end: number; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const short = (ts: number, withYear = false) =>
    new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });

  switch (mode) {
    case 'week': {
      const base = weekBounds(now);
      const start = new Date(base.start).setDate(new Date(base.start).getDate() + offset * 7);
      const end = new Date(start).setDate(new Date(start).getDate() + 7);
      const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${short(start)} – ${short(end - DAY_MS)}`;
      return { start, end, label };
    }
    case 'month': {
      const start = new Date(y, m + offset, 1).getTime();
      const end = new Date(y, m + offset + 1, 1).getTime();
      return { start, end, label: new Date(start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
    }
    case 'quarter': {
      const start = new Date(y, m - 2 + offset * 3, 1).getTime();
      const end = new Date(y, m + 1 + offset * 3, 1).getTime();
      const a = new Date(start).toLocaleDateString('en-IN', { month: 'short' });
      const b = new Date(end - DAY_MS).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      return { start, end, label: `${a} – ${b}` };
    }
    case 'year': {
      const start = new Date(y + offset, 0, 1).getTime();
      const end = new Date(y + offset + 1, 0, 1).getTime();
      return { start, end, label: String(y + offset) };
    }
  }
}

async function loadSeries(mode: Mode, start: number, end: number): Promise<BarDatum[]> {
  const today = startOfDay(Date.now());
  if (mode === 'year') {
    const points = await ledgerService.getSpendingSeries(start, end, 'month');
    const now = new Date();
    return points.map((p) => {
      const d = new Date(p.start);
      return {
        key: p.start,
        label: p.label.charAt(0),
        detail: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        value: p.totalPaise,
        highlight: d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(),
      };
    });
  }

  const days = await ledgerService.getSpendingSeries(start, end, 'day');
  if (mode === 'quarter') {
    const weeks: BarDatum[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const first = chunk[0].start;
      const last = chunk[chunk.length - 1].start;
      weeks.push({
        key: first,
        label: new Date(first).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        detail: `${new Date(first).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        value: chunk.reduce((s, d) => s + d.totalPaise, 0),
        highlight: today >= first && today <= last,
      });
    }
    return weeks;
  }

  return days.map((p) => ({
    key: p.start,
    label: mode === 'week' ? new Date(p.start).toLocaleDateString('en-IN', { weekday: 'short' }) : p.label,
    detail: formatDayLabel(p.start),
    value: p.totalPaise,
    highlight: p.start === today,
  }));
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [mode, setMode] = useState<Mode>('month');
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => rangeFor(mode, offset), [mode, offset]);

  const fetcher = useCallback(async () => {
    // For the current (unfinished) period, compare against the same elapsed
    // span of the previous one, not its full length.
    const prevFull = rangeFor(mode, offset - 1);
    const elapsed = Date.now() - range.start;
    const prev =
      offset === 0 && elapsed < range.end - range.start
        ? { start: prevFull.start, end: Math.min(prevFull.end, prevFull.start + elapsed) }
        : prevFull;
    const period = { start: range.start, end: range.end, label: range.label };
    const [totals, prevTotals, series, categories, merchants, members, largest, budgets, income, incomeSources] = await Promise.all([
      ledgerService.getHistoryTotals({ kind: 'EXPENSE', start: range.start, end: range.end }),
      ledgerService.getHistoryTotals({ kind: 'EXPENSE', start: prev.start, end: prev.end }),
      loadSeries(mode, range.start, range.end),
      ledgerService.getCategoryShares(range.start, range.end),
      analyticsService.getMerchantSpending(period, 5),
      analyticsService.getMemberSpending(period),
      ledgerService.getLargestExpense(range.start, range.end),
      mode === 'month' ? budgetService.getMonthlyBudgets(new Date(range.start)) : Promise.resolve([]),
      ledgerService.incomeBetween(range.start, range.end),
      ledgerService.getCategoryShares(range.start, range.end, 'INCOME'),
    ]);
    const elapsedDays = Math.max(1, Math.ceil((Math.min(Date.now(), range.end) - range.start) / DAY_MS));
    return {
      totals,
      prevTotals,
      series,
      categories,
      merchants,
      members,
      largest,
      budgets,
      income: income.total,
      incomeSources,
      elapsedDays,
      partial: prev !== prevFull,
    };
  }, [mode, offset, range]);

  const { data, error, refreshing, refresh, reload } = useScreenData(fetcher);

  const changeMode = (next: Mode) => {
    setMode(next);
    setOffset(0);
  };

  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <LoadingView />;

  const { totals, prevTotals } = data;
  const [whole, fraction] = splitINR(totals.total);
  const change = prevTotals.total > 0 ? (totals.total - prevTotals.total) / prevTotals.total : null;
  const perDay = Math.round(totals.total / data.elapsedDays);
  const previousLabel = { week: 'last week', month: 'last month', quarter: 'previous 3 months', year: 'last year' }[mode];
  const isEmpty = totals.count === 0;

  // Derived observations
  const insights: { icon: IconName; color: string; title: string; body: string }[] = [];
  const topCategory = data.categories.find((c) => c.categoryId);
  if (topCategory) {
    insights.push({
      icon: 'pie',
      color: topCategory.color ?? colors.brand,
      title: `${topCategory.name} leads your spending`,
      body: `${Math.round(topCategory.share * 100)}% of the total, ${formatINR(topCategory.totalPaise)} across ${pluralize(topCategory.count, 'expense')}.`,
    });
  }
  const frequent = [...data.merchants].sort((a, b) => b.transactionCount - a.transactionCount)[0];
  if (frequent && frequent.transactionCount >= 2) {
    insights.push({
      icon: 'store',
      color: colors.info,
      title: `You paid ${frequent.canonicalName} ${frequent.transactionCount} times`,
      body: `${formatINR(frequent.totalPaise)} in total, about ${formatINR(Math.round(frequent.totalPaise / frequent.transactionCount))} each time.`,
    });
  }
  if (data.largest) {
    insights.push({
      icon: 'zap',
      color: colors.warning,
      title: `Biggest expense: ${formatINR(data.largest.amountPaise)}`,
      body: `${data.largest.merchant} on ${formatDayLabel(data.largest.timestamp)}.`,
    });
  }
  const uncategorized = data.categories.find((c) => !c.categoryId);
  if (uncategorized && uncategorized.count > 0) {
    insights.push({
      icon: 'tag',
      color: colors.textTertiary,
      title: `${pluralize(uncategorized.count, 'expense')} without a category`,
      body: 'Categorize them for more accurate insights and budgets.',
    });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader large title="Insights" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} tintColor={colors.brand} />}
      >
        <SegmentedControl options={MODES} value={mode} onChange={changeMode} />

        <View style={styles.periodNav}>
          <IconButton icon="chevronLeft" size={36} accessibilityLabel="Previous period" onPress={() => setOffset((o) => o - 1)} />
          <Text variant="bodyStrong">{range.label}</Text>
          <IconButton
            icon="chevronRight"
            size={36}
            accessibilityLabel="Next period"
            disabled={offset >= 0}
            color={offset >= 0 ? colors.textDisabled : colors.text}
            onPress={() => setOffset((o) => Math.min(0, o + 1))}
          />
        </View>

        {/* Summary */}
        <Card>
          <Text variant="overline">Total spent</Text>
          <View style={styles.amountRow}>
            <Text variant="hero" numeric>
              {whole}
            </Text>
            <Text variant="heading" color={colors.textTertiary} numeric style={{ marginBottom: 4 }}>
              {fraction}
            </Text>
          </View>
          {change !== null ? (
            <View style={styles.changeRow}>
              <Icon
                name={change > 0 ? 'trendingUp' : 'trendingDown'}
                size={16}
                color={change > 0 ? colors.negative : colors.positive}
              />
              <Text variant="label" color={change > 0 ? colors.negative : colors.positive}>
                {Math.abs(change) >= 10 ? 'Far' : `${Math.round(Math.abs(change) * 100)}%`} {change > 0 ? 'more' : 'less'} than{' '}
                {previousLabel}
                {data.partial ? ' so far' : ''}
              </Text>
            </View>
          ) : (
            <Text variant="label" style={{ marginTop: space.xxs }}>
              Nothing to compare with {previousLabel}
            </Text>
          )}
          <View style={styles.statRow}>
            <Stat label="Expenses" value={String(totals.count)} />
            <Stat label="Per day" value={formatCompactINR(perDay)} />
            <Stat label="Average" value={totals.count ? formatCompactINR(Math.round(totals.total / totals.count)) : '₹0'} />
          </View>
        </Card>

        {data.income > 0 ? <CashflowCard income={data.income} spent={totals.total} sources={data.incomeSources} /> : null}

        {isEmpty ? (
          <Card style={styles.block}>
            <EmptyState
              compact
              icon="chart"
              title="No spending in this period"
              message="Pick another period, or add expenses to see trends and breakdowns."
            />
          </Card>
        ) : (
          <>
            <View style={styles.block}>
              <SectionTitle title="Spending trend" />
              <Card>
                <BarChart data={data.series} labelEvery={mode === 'month' ? 5 : mode === 'quarter' ? 3 : 1} />
              </Card>
            </View>

            <View style={styles.block}>
              <SectionTitle title="Where it went" />
              <Card>
                <View style={styles.donutWrap}>
                  <Donut
                    slices={data.categories.map((c) => ({ key: c.categoryId ?? 'none', value: c.totalPaise, color: c.color ?? colors.textTertiary }))}
                  >
                    <Text variant="caption">{pluralize(data.categories.length, 'category', 'categories')}</Text>
                    <Text variant="heading" numeric>
                      {formatCompactINR(totals.total)}
                    </Text>
                  </Donut>
                </View>
                {data.categories.map((c) => (
                  <View key={c.categoryId ?? 'none'} style={styles.breakdownRow}>
                    {c.categoryId ? <CategoryAvatar icon={c.icon} color={c.color} size={36} /> : <UncategorizedAvatar size={36} />}
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.breakdownText}>
                        <Text variant="labelStrong" numberOfLines={1} style={{ flex: 1 }}>
                          {c.name}
                        </Text>
                        <Text variant="labelStrong" numeric>
                          {formatINR(c.totalPaise, { decimals: 'never' })}
                        </Text>
                      </View>
                      <View style={styles.breakdownText}>
                        <View style={{ flex: 1 }}>
                          <ProgressBar value={c.share} color={c.color ?? colors.textTertiary} height={6} />
                        </View>
                        <Text variant="caption" numeric style={styles.pct}>
                          {Math.round(c.share * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            </View>

            {data.budgets.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle title="Budgets" action="Manage" onAction={() => router.push('/budgets')} />
                <Card>
                  {data.budgets.map((b, i) => {
                    const over = b.spentPaise > b.budget.amountPaise;
                    const barColor = b.status === 'EXCEEDED' ? colors.negative : b.status === 'WARNING' ? colors.warning : colors.positive;
                    return (
                      <View key={b.budget.id} style={[styles.budgetRow, i > 0 && styles.budgetDivider]}>
                        <View style={styles.breakdownText}>
                          <Text variant="labelStrong" style={{ flex: 1 }}>
                            {b.category?.name ?? b.budget.name}
                          </Text>
                          <Text variant="label" numeric>
                            {formatCompactINR(b.spentPaise)} / {formatCompactINR(b.budget.amountPaise)}
                          </Text>
                        </View>
                        <ProgressBar value={b.spentPaise / b.budget.amountPaise} color={barColor} />
                        <Text variant="caption" color={over ? colors.negative : colors.textTertiary}>
                          {over ? `${formatINR(-b.remainingPaise)} over budget` : `${formatINR(b.remainingPaise)} left`}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              </View>
            ) : null}

            {data.merchants.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle title="Top merchants" />
                <Card>
                  {data.merchants.map((mch, i) => (
                    <View key={mch.merchantId} style={styles.merchantRow}>
                      <View style={styles.rank}>
                        <Text variant="labelStrong" color={colors.brand}>
                          {i + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelStrong" numberOfLines={1}>
                          {mch.canonicalName}
                        </Text>
                        <Text variant="caption">{pluralize(mch.transactionCount, 'payment')}</Text>
                      </View>
                      <Text variant="labelStrong" numeric>
                        {formatINR(mch.totalPaise, { decimals: 'never' })}
                      </Text>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}

            {data.members.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle title="Spent on" />
                <Card>
                  {data.members.map((mem) => (
                    <View key={mem.memberId} style={styles.breakdownRow}>
                      <MemberAvatar name={mem.memberName} color={mem.memberColor} size={36} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={styles.breakdownText}>
                          <Text variant="labelStrong" style={{ flex: 1 }}>
                            {mem.memberName}
                          </Text>
                          <Text variant="labelStrong" numeric>
                            {formatINR(mem.totalPaise, { decimals: 'never' })}
                          </Text>
                        </View>
                        <ProgressBar value={mem.percentage / 100} color={mem.memberColor ?? colors.brand} height={6} />
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}

            {insights.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle title="Highlights" />
                <View style={{ gap: space.sm }}>
                  {insights.map((ins) => (
                    <Card key={ins.title} style={styles.insight}>
                      <IconTile icon={ins.icon} color={ins.color} />
                      <View style={{ flex: 1 }}>
                        <Text variant="labelStrong">{ins.title}</Text>
                        <Text variant="caption" style={{ marginTop: 2 }}>
                          {ins.body}
                        </Text>
                      </View>
                    </Card>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CashflowCard({ income, spent, sources }: { income: number; spent: number; sources: CategoryShare[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const net = income - spent;
  const rate = income > 0 ? net / income : 0;
  const max = Math.max(income, spent, 1);
  return (
    <View style={styles.block}>
      <SectionTitle title="Money in and out" />
      <Card>
        <View style={styles.flowRow}>
          <Text variant="label" style={styles.flowLabel}>
            In
          </Text>
          <View style={styles.flowTrack}>
            <View style={[styles.flowBar, { width: `${(income / max) * 100}%`, backgroundColor: colors.positive }]} />
          </View>
          <Text variant="labelStrong" numeric style={styles.flowValue}>
            {formatCompactINR(income)}
          </Text>
        </View>
        <View style={styles.flowRow}>
          <Text variant="label" style={styles.flowLabel}>
            Out
          </Text>
          <View style={styles.flowTrack}>
            <View style={[styles.flowBar, { width: `${(spent / max) * 100}%`, backgroundColor: colors.brand }]} />
          </View>
          <Text variant="labelStrong" numeric style={styles.flowValue}>
            {formatCompactINR(spent)}
          </Text>
        </View>
        <View style={styles.flowNet}>
          <Text variant="label">{net >= 0 ? 'Saved' : 'Spent more than earned'}</Text>
          <Text variant="heading" numeric color={net >= 0 ? colors.positive : colors.negative}>
            {formatINR(Math.abs(net), { decimals: 'never' })}
            {net >= 0 ? `  ·  ${Math.round(rate * 100)}%` : ''}
          </Text>
        </View>
        {sources.length > 0 ? (
          <Text variant="caption" style={{ marginTop: space.xs }}>
            From {sources.slice(0, 3).map((s) => s.name).join(', ')}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text variant="caption">{label}</Text>
      <Text variant="bodyStrong" numeric style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  flowLabel: {
    width: 32,
  },
  flowTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  flowBar: {
    height: 12,
    borderRadius: 6,
  },
  flowValue: {
    width: 64,
    textAlign: 'right',
  },
  flowNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
  },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: space.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: space.xxs,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xxs,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stat: {
    flex: 1,
  },
  block: {
    marginTop: space.xl,
  },
  donutWrap: {
    alignItems: 'center',
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  breakdownText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  pct: {
    width: 36,
    textAlign: 'right',
  },
  budgetRow: {
    gap: space.xs,
    paddingVertical: space.xs,
  },
  budgetDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    marginTop: space.xs,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
}));
