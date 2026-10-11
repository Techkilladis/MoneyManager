// Analytics Screen - Comprehensive financial analytics with interactive charts
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  Column,
  BodyEmphasis, 
  Body, 
  Footnote, 
  Badge,
  Divider,
  Button,
  Title1,
  Title2,
  Headline,
  Caption1,
  Caption2,
  Micro,
  SectionHeader,
  TextPrimitive,
  ListItem,
  DisplayMedium,
} from '@/design/primitives';
import { analyticsService, budgetService } from '@/services';
import { formatCurrency } from '@/domain/transaction';
import { colors, spacing, radius, shadows, typography } from '@/design/tokens';
import { PieChart, LineChart, BarChart, yAxisSides } from 'react-native-gifted-charts';
import { openDatabase } from '@/database/db';

type PeriodPreset = '7d' | '1m' | '3m' | '6m' | '1y' | 'custom';

interface PeriodRange {
  start: number;
  end: number;
  label: string;
}

interface AnalyticsData {
  total: { totalPaise: number; transactionCount: number };
  categories: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    categoryColor: string | null;
    totalPaise: number;
    transactionCount: number;
    percentage: number;
  }>;
  merchants: Array<{
    merchantId: string;
    merchantName: string;
    canonicalName: string;
    totalPaise: number;
    transactionCount: number;
  }>;
  members: Array<{
    memberId: string;
    memberName: string;
    memberColor: string | null;
    totalPaise: number;
    transactionCount: number;
    percentage: number;
  }>;
  dailyTrend: Array<{
    date: number;
    dateLabel: string;
    totalPaise: number;
    transactionCount: number;
  }>;
  uncategorized: { totalPaise: number; transactionCount: number; percentage?: number };
  monthlyComparison: {
    currentMonth: { totalPaise: number; transactionCount: number };
    previousMonth: { totalPaise: number; transactionCount: number };
    differencePaise: number;
    differencePercent: number;
    direction: 'higher' | 'lower' | 'same';
  };
  insights: Array<{
    type: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'alert';
    relatedData?: any;
  }>;
}

interface MonthlySpending {
  month: number;
  year: number;
  totalPaise: number;
  transactionCount: number;
  label: string;
}

const PRESET_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Food': '#FF9500',
  'Travel': '#007AFF',
  'Shopping': '#AF52DE',
  'Bills': '#FF3B30',
  'Entertainment': '#FF2D92',
  'Health': '#34C759',
  'Education': '#5856D6',
  'Subscriptions': '#00C7BE',
  'Family': '#FF9F0A',
  'Personal': '#8E8E93',
  'Miscellaneous': '#C7C7CC',
  'Uncategorized': '#8E8E93',
};

function getMonthlyPeriodBounds(year: number, month: number): { start: number; end: number } {
  const start = new Date(year, month, 1, 0, 0, 0, 0).getTime();
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0).getTime();
  return { start, end };
}

// Loads the last 12 months of confirmed spending directly from the database.
// Module-level: it does not depend on component state, so effects can call it
// without capturing stale closures.
async function loadMonthlySpending(period: PeriodRange): Promise<MonthlySpending[]> {
  const database = await openDatabase();
  const now = new Date();
  const months: MonthlySpending[] = [];

  for (let i = 11; i >= 0; i--) {
    const year = now.getMonth() - i < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = (now.getMonth() - i + 12) % 12;

    const { start, end } = getMonthlyPeriodBounds(year, month);

    const row = await database.getFirstAsync<{ total: number; count: number }>(
      `SELECT 
          COALESCE(SUM(amountPaise), 0) as total,
          COUNT(*) as count
         FROM transactions 
         WHERE status = 'CONFIRMED'
         AND is_pending_capture = 0
         AND is_dismissed = 0
         AND transactionTimestamp >= ?
         AND transactionTimestamp < ?`,
      [start, end]
    );

    months.push({
      month,
      year,
      totalPaise: row?.total || 0,
      transactionCount: row?.count || 0,
      label: new Date(year, month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    });
  }

  return months;
}

// Loads all budgets with their spending progress for a period.
async function loadBudgets(period: PeriodRange) {
  const budgetResults = await budgetService.getAllBudgetsWithSpending(period.start, period.end);
  return budgetResults;
}


export default function AnalyticsScreen() {
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('1m');
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [monthlySpending, setMonthlySpending] = useState<MonthlySpending[]>([]);
  const [budgets, setBudgets] = useState<Array<{
    budget: any;
    spentPaise: number;
    remainingPaise: number;
    percentageUsed: number;
    status: 'HEALTHY' | 'WARNING' | 'EXCEEDED';
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const periodRange = useMemo((): PeriodRange => {
    const now = new Date();
    
    switch (selectedPreset) {
      case '7d': {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        const start = end - 7 * 24 * 60 * 60 * 1000;
        return { start, end, label: 'Last 7 Days' };
      }
      case '1m': {
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return { start, end, label: 'This Month' };
      }
      case '3m': {
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
        return { start, end, label: 'Last 3 Months' };
      }
      case '6m': {
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
        return { start, end, label: 'Last 6 Months' };
      }
      case '1y': {
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const start = new Date(now.getFullYear() - 1, now.getMonth(), 1).getTime();
        return { start, end, label: 'Last Year' };
      }
      case 'custom': {
        if (customRange) {
          const start = new Date(customRange.start).setHours(0, 0, 0, 0);
          const end = new Date(customRange.end).setHours(23, 59, 59, 999);
          return { start, end, label: 'Custom Range' };
        }
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return { start, end, label: 'This Month' };
      }
    }
  }, [selectedPreset, customRange]);

  // Track mount state and the latest in-flight request so stale responses
  // never overwrite newer results and results are ignored after unmount.
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetches all analytics data for a period. Pure data loading — no state
  // updates, so it is safe to call from effects.
  const fetchAnalyticsData = useCallback(async (period: PeriodRange): Promise<{
    analyticsData: AnalyticsData;
    monthlyData: MonthlySpending[];
    budgetData: Awaited<ReturnType<typeof budgetService.getAllBudgetsWithSpending>>;
  }> => {
    const [analyticsData, monthlyData, budgetData] = await Promise.all([
      analyticsService.getAnalytics(period),
      loadMonthlySpending(period),
      loadBudgets(period),
    ]);
    return { analyticsData, monthlyData, budgetData };
  }, []);

  // Fetches and applies analytics data. All setState calls happen in promise
  // callbacks (never in the synchronous body), so this is safe to call from
  // effects as well as event handlers.
  const loadAnalytics = useCallback((period: PeriodRange): void => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => mountedRef.current && requestId === requestIdRef.current;

    fetchAnalyticsData(period)
      .then(({ analyticsData, monthlyData, budgetData }) => {
        if (!isCurrent()) return;
        setAnalytics(analyticsData);
        setMonthlySpending(monthlyData);
        setBudgets(budgetData);
      })
      .catch((err) => {
        if (!isCurrent()) return;
        console.error('[Analytics] Load error:', err);
      })
      .finally(() => {
        if (!isCurrent()) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [fetchAnalyticsData]);

  useEffect(() => {
    loadAnalytics(periodRange);
  }, [loadAnalytics, periodRange]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics(periodRange);
  };

  const onPresetChange = (preset: PeriodPreset) => {
    // Enter the loading state while reloading, but only when the period will
    // actually change (a no-op tap triggers no reload, so it must not set a
    // loading state that would never be cleared).
    if (preset !== selectedPreset) {
      setLoading(true);
    }
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      setCustomRange(null);
    }
  };

  const onCustomRangeSelect = (range: { start: Date; end: Date }) => {
    setCustomRange(range);
    setSelectedPreset('custom');
    setLoading(true);
  };

  const formatPaise = (paise: number): string => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCompactPaise = (paise: number): string => {
    const rupees = paise / 100;
    if (rupees >= 100000) {
      return `₹${(rupees / 100000).toFixed(1)}L`;
    } else if (rupees >= 1000) {
      return `₹${(rupees / 1000).toFixed(1)}K`;
    }
    return `₹${rupees.toFixed(0)}`;
  };

  // Prepare chart data
  const donutChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.categories
      .filter(c => c.totalPaise > 0)
      .map((c, i) => ({
        value: c.totalPaise,
        color: c.categoryColor || CATEGORY_COLORS[c.categoryName] || colors.accent,
        text: c.categoryName,
        tooltipText: `${c.categoryName}: ${formatPaise(c.totalPaise)} (${c.percentage.toFixed(1)}%)`,
      }));
  }, [analytics]);

  const trendChartData = useMemo(() => {
    if (!analytics) return [];
    // Keep index-based spacing: do not pass explicit `x` values. Combined with
    // the `gifted-charts-core` override in package.json (0.1.43, the version
    // react-native-gifted-charts 1.4.28 is built against), this keeps data
    // point positions finite for every possible point count, including a
    // single trend point.
    return analytics.dailyTrend.map((d) => ({
      value: d.totalPaise,
      label: d.dateLabel,
    }));
  }, [analytics]);

  const categoryBarChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.categories
      .filter(c => c.totalPaise > 0)
      .map((c, i) => ({
        value: c.totalPaise,
        label: c.categoryName,
        color: c.categoryColor || CATEGORY_COLORS[c.categoryName] || colors.accent,
      }));
  }, [analytics]);

  const monthlyBarChartData = useMemo(() => {
    return monthlySpending.map((m, i) => ({
      value: m.totalPaise,
      label: m.label,
      color: m.month === new Date().getMonth() && m.year === new Date().getFullYear() 
        ? colors.accent 
        : colors.accentLight,
    }));
  }, [monthlySpending]);

  const memberBarChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.members
      .filter(m => m.totalPaise > 0)
      .map((m, i) => ({
        value: m.totalPaise,
        label: m.memberName,
        color: m.memberColor || colors.accent,
      }));
  }, [analytics]);

  if (loading && !analytics) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Body color={colors.textTertiary}>Loading analytics…</Body>
      </Screen>
    );
  }

  const totalSpending = analytics?.total.totalPaise || 0;
  const avgDaily = analytics?.dailyTrend.length 
    ? Math.round(totalSpending / Math.max(1, analytics.dailyTrend.length))
    : 0;
  const transactionCount = analytics?.total.transactionCount || 0;
  const monthlyComp = analytics?.monthlyComparison;

  return (
    <Screen>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            progressViewOffset={Platform.OS === 'ios' ? 20 : 0}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[25] }}
      >
        {/* Header with Period Selector */}
        <Section paddedHorizontal style={{ paddingTop: spacing[2], paddingBottom: spacing[2] }}>
          <Row justify="space-between" align="center">
            <Title1 style={{ letterSpacing: typography.letterSpacing.display }}>Analytics</Title1>
          </Row>
          
          {/* Period Picker */}
          <View style={{ marginTop: spacing[3] }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: spacing[2] }}>
              {PRESET_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.periodButton,
                    selectedPreset === opt.value && styles.periodButtonActive,
                  ]}
                  onPress={() => onPresetChange(opt.value)}
                >
                  <TextPrimitive
                    variant="caption1"
                    style={[
                      styles.periodButtonText,
                      selectedPreset === opt.value && styles.periodButtonTextActive,
                    ]}
                  >
                    {opt.label}
                  </TextPrimitive>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Custom Range Display */}
            {selectedPreset === 'custom' && customRange && (
              <Body color={colors.textTertiary} style={{ marginTop: spacing[2], textAlign: 'center' }}>
                {customRange.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' — '}
                {customRange.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Body>
            )}
          </View>
        </Section>

        {/* Spending Summary Cards */}
        <Section paddedHorizontal style={{ paddingBottom: spacing[3] }}>
          <Row gap={spacing[2]} style={{ flexWrap: 'wrap' }}>
            <Card variant="outlined" style={{ flex: 1, minWidth: 140, padding: spacing[4] }}>
              <Column gap={spacing[1]} align="center">
                <Micro color={colors.textSecondary}>TOTAL SPENDING</Micro>
                <Headline color={colors.textPrimary}>{formatPaise(totalSpending)}</Headline>
                {monthlyComp && (
                  <Caption1 
                    color={monthlyComp.direction === 'higher' ? colors.error : monthlyComp.direction === 'lower' ? colors.success : colors.textTertiary}
                    style={{ textAlign: 'center' }}
                  >
                    {monthlyComp.direction === 'higher' ? '▲' : monthlyComp.direction === 'lower' ? '▼' : '→'}
                    {monthlyComp.differencePercent}% vs last month
                  </Caption1>
                )}
              </Column>
            </Card>
            
            <Card variant="outlined" style={{ flex: 1, minWidth: 140, padding: spacing[4] }}>
              <Column gap={spacing[1]} align="center">
                <Micro color={colors.textSecondary}>AVG PER DAY</Micro>
                <Headline color={colors.textPrimary}>{formatPaise(avgDaily)}</Headline>
                <Caption1 color={colors.textTertiary}>
                  {analytics?.dailyTrend.length || 0} active days
                </Caption1>
              </Column>
            </Card>
            
            <Card variant="outlined" style={{ flex: 1, minWidth: 140, padding: spacing[4] }}>
              <Column gap={spacing[1]} align="center">
                <Micro color={colors.textSecondary}>TRANSACTIONS</Micro>
                <Headline color={colors.textPrimary}>{transactionCount}</Headline>
                <Caption1 color={colors.textTertiary}>
                  Confirmed
                </Caption1>
              </Column>
            </Card>
            
            <Card variant="outlined" style={{ flex: 1, minWidth: 140, padding: spacing[4] }}>
              <Column gap={spacing[1]} align="center">
                <Micro color={colors.textSecondary}>AVG TXN</Micro>
                <Headline color={colors.textPrimary}>
                  {transactionCount > 0 ? formatPaise(Math.round(totalSpending / transactionCount)) : '₹0'}
                </Headline>
                <Caption1 color={colors.textTertiary}>
                  Per transaction
                </Caption1>
              </Column>
            </Card>
          </Row>
        </Section>

        {/* Category Distribution - Donut Chart */}
        {analytics && analytics.categories.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader title="Spending by Category" subtitle={`${analytics.categories.filter(c => c.totalPaise > 0).length} categories`} />
            <Card variant="outlined" style={{ padding: spacing[4] }}>
              <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
                <PieChart
                  data={donutChartData}
                  radius={100}
                  innerRadius={70}
                  donut={true}
                  isAnimated={true}
                  animationDuration={800}
                  showText={false}
                  showTooltip={true}
                  showValuesAsTooltipText={true}
                  centerLabelComponent={() => (
                    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                      <DisplayMedium style={{ letterSpacing: typography.letterSpacing.display }}>{formatPaise(totalSpending)}</DisplayMedium>
                      <Caption1 color={colors.textTertiary}>Total</Caption1>
                    </View>
                  )}
                />
              </View>
              
              {/* Category Legend */}
              <View style={{ marginTop: spacing[4], flexWrap: 'wrap', flexDirection: 'row', gap: spacing[2], justifyContent: 'center' }}>
                {analytics.categories
                  .filter(c => c.totalPaise > 0)
                  .map((c, i) => (
                    <TouchableOpacity
                      key={c.categoryId}
                      style={styles.legendItem}
                      onPress={() => {}}
                    >
                      <View style={[
                        styles.legendColorDot,
                        { backgroundColor: c.categoryColor || CATEGORY_COLORS[c.categoryName] || colors.accent }
                      ]} />
                      <TextPrimitive variant="caption2" color={colors.textSecondary}>
                        {c.categoryName} {c.percentage.toFixed(1)}%
                      </TextPrimitive>
                    </TouchableOpacity>
                  ))}
                {analytics.uncategorized.totalPaise > 0 && (
                  <TouchableOpacity style={styles.legendItem}>
                    <View style={[styles.legendColorDot, { backgroundColor: CATEGORY_COLORS.Uncategorized }]} />
                    <TextPrimitive variant="caption2" color={colors.textTertiary}>
                      Uncategorized {analytics.uncategorized.percentage?.toFixed(1) || 0}%
                    </TextPrimitive>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          </Section>
        )}

        {/* Spending Trend - Line Chart */}
        {analytics && analytics.dailyTrend.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader title="Spending Trend" subtitle="Daily totals" />
            <Card variant="outlined" style={{ padding: spacing[4] }}>
              <View style={{ height: 200 }}>
                <LineChart
                  data={trendChartData}
                  width={340}
                  height={200}
                  isAnimated={true}
                  animationDuration={800}
                  color={colors.accent}
                  areaChart={true}
                  startFillColor={colors.accent + '40'}
                  endFillColor={colors.accent + '00'}
                  hideDataPoints={false}
                  dataPointsColor={colors.accent}
                  dataPointsRadius={4}
                  dataPointsWidth={8}
                  dataPointsHeight={8}
                  showXAxisIndices={true}
                  xAxisLabelsAtBottom={true}
                  xAxisTextNumberOfLines={1}
                  hideYAxisText={false}
                  yAxisTextStyle={{ fontSize: 10, color: colors.textTertiary }}
                  curved={true}
                  curvature={0.35}
                  thickness={2}
                  rulesColor={colors.dividerLight}
                  rulesLength={4}
                />
              </View>
            </Card>
          </Section>
        )}

        {/* Category Comparison - Horizontal Bar Chart */}
        {analytics && analytics.categories.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader title="Category Comparison" subtitle="Sorted by spending" />
            <Card variant="outlined" style={{ padding: spacing[4] }}>
              <View style={{ height: Math.max(200, analytics.categories.filter(c => c.totalPaise > 0).length * 35 + 40) }}>
                <BarChart
                  data={categoryBarChartData}
                  width={340}
                  height={Math.max(200, analytics.categories.filter(c => c.totalPaise > 0).length * 35 + 40)}
                  horizontal={true}
                  isAnimated={true}
                  animationDuration={800}
                  spacing={8}
                  barWidth={28}
                  showXAxisIndices={true}
                  showYAxisIndices={true}
                  xAxisLabelsAtBottom={false}
                  yAxisSide={yAxisSides.LEFT}
                  yAxisLabelWidth={100}
                  showValuesAsTopLabel={true}
                  topLabelTextStyle={{ fontSize: 10, color: colors.textPrimary }}
                  formatYLabel={(label) => formatCompactPaise(parseFloat(label))}
                  rulesColor={colors.dividerLight}
                  rulesLength={4}
                  hideYAxisText={false}
                  yAxisTextStyle={{ fontSize: 10, color: colors.textTertiary }}
                />
              </View>
            </Card>
          </Section>
        )}

        {/* Monthly Spending - Vertical Bar Chart */}
        <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
          <SectionHeader title="Monthly Spending" subtitle="Last 12 months" />
          <Card variant="outlined" style={{ padding: spacing[4] }}>
            <View style={{ height: 200 }}>
              <BarChart
                data={monthlyBarChartData}
                width={340}
                height={200}
                horizontal={false}
                isAnimated={true}
                animationDuration={800}
                spacing={8}
                barWidth={20}
                showXAxisIndices={true}
                showYAxisIndices={true}
                xAxisLabelsAtBottom={true}
                xAxisTextNumberOfLines={1}
                hideYAxisText={false}
                yAxisTextStyle={{ fontSize: 10, color: colors.textTertiary }}
                rulesColor={colors.dividerLight}
                rulesLength={4}
                showValuesAsTopLabel={true}
                topLabelTextStyle={{ fontSize: 10, color: colors.textPrimary }}
                formatYLabel={(label) => formatCompactPaise(parseFloat(label))}
              />
            </View>
          </Card>
        </Section>

        {/* Top Merchants */}
        {analytics && analytics.merchants.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader 
              title="Top Merchants" 
              subtitle={`${analytics.merchants.length} merchants`}
              action={{ label: 'View All', onPress: () => {} }}
            />
            <Card variant="outlined">
              {analytics.merchants.slice(0, 5).map((merchant, i) => (
                <TouchableOpacity
                  key={merchant.merchantId}
                  style={[styles.merchantRow, i === analytics.merchants.length - 1 ? { borderBottomWidth: 0 } : {}]}
                  activeOpacity={0.8}
                >
                  <Column gap={spacing[1]} style={{ flex: 1, minWidth: 0 }}>
                    <BodyEmphasis numberOfLines={1} ellipsizeMode="tail">{merchant.canonicalName}</BodyEmphasis>
                    <Caption1 color={colors.textTertiary}>
                      {merchant.transactionCount} transaction{merchant.transactionCount > 1 ? 's' : ''} • {((merchant.totalPaise / totalSpending) * 100).toFixed(1)}%
                    </Caption1>
                  </Column>
                  <BodyEmphasis style={{ textAlign: 'right', marginLeft: spacing[3] }}>{formatPaise(merchant.totalPaise)}</BodyEmphasis>
                </TouchableOpacity>
              ))}
              {analytics.merchants.length > 5 && (
                <TouchableOpacity style={styles.viewAllButton} onPress={() => {}}>
                  <TextPrimitive variant="buttonSmall" color={colors.accent}>View all {analytics.merchants.length} merchants</TextPrimitive>
                </TouchableOpacity>
              )}
            </Card>
          </Section>
        )}

        {/* Member Breakdown */}
        {analytics && analytics.members.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader title="Spending by Member" subtitle={`${analytics.members.length} members`} />
            <Card variant="outlined" style={{ padding: spacing[4] }}>
              <View style={{ height: Math.max(180, analytics.members.filter(m => m.totalPaise > 0).length * 35 + 40) }}>
                <BarChart
                  data={memberBarChartData}
                  width={340}
                  height={Math.max(180, analytics.members.filter(m => m.totalPaise > 0).length * 35 + 40)}
                  horizontal={true}
                  isAnimated={true}
                  animationDuration={800}
                  spacing={8}
                  barWidth={28}
                  showXAxisIndices={true}
                  showYAxisIndices={true}
                  xAxisLabelsAtBottom={false}
                  yAxisSide={yAxisSides.LEFT}
                  yAxisLabelWidth={80}
                  showValuesAsTopLabel={true}
                  topLabelTextStyle={{ fontSize: 10, color: colors.textPrimary }}
                  formatYLabel={(label) => formatCompactPaise(parseFloat(label))}
                  rulesColor={colors.dividerLight}
                  rulesLength={4}
                  hideYAxisText={false}
                  yAxisTextStyle={{ fontSize: 10, color: colors.textTertiary }}
                />
              </View>
              
              {/* Unassigned */}
              {analytics.uncategorized.totalPaise > 0 && (
                <View style={{ marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.dividerLight }}>
                  <Row justify="space-between" align="center">
                    <Row gap={spacing[2]} align="center">
                      <View style={[styles.legendColorDot, { backgroundColor: colors.textQuaternary }]} />
                      <BodyEmphasis>Unassigned</BodyEmphasis>
                    </Row>
                    <BodyEmphasis>{formatPaise(analytics.uncategorized.totalPaise)}</BodyEmphasis>
                  </Row>
                </View>
              )}
            </Card>
          </Section>
        )}

        {/* Budget Progress */}
        {budgets && budgets.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader 
              title="Budget Progress" 
              subtitle={`${budgets.length} active budget${budgets.length > 1 ? 's' : ''}`}
              action={{ label: 'Manage', onPress: () => {} }}
            />
            <Card variant="outlined">
              {budgets.map((b, i) => (
                <View key={b.budget.id} style={[styles.budgetRow, i > 0 && { paddingTop: spacing[3], marginTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.dividerLight }]}>
                  <Row justify="space-between" align="center" style={{ marginBottom: spacing[2] }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <BodyEmphasis>{b.budget.category?.name || 'Budget'}</BodyEmphasis>
                      <Caption1 color={colors.textTertiary}>
                        {formatPaise(b.spentPaise)} / {formatPaise(b.budget.amountPaise)}
                      </Caption1>
                    </View>
                    <Badge 
                      variant={b.status === 'HEALTHY' ? 'success' : b.status === 'WARNING' ? 'warning' : 'error'} 
                      size="small"
                    >
                      <Caption2>{b.status}</Caption2>
                    </Badge>
                  </Row>
                  <View style={{ height: 8, backgroundColor: colors.backgroundAlt, borderRadius: 4, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.min(b.percentageUsed, 100)}%`,
                        height: '100%',
                        backgroundColor: b.status === 'HEALTHY' ? colors.success : b.status === 'WARNING' ? colors.warning : colors.error,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <Caption1 color={colors.textTertiary} style={{ marginTop: spacing[1], textAlign: 'right' }}>
                    {b.percentageUsed}% used • {b.remainingPaise >= 0 ? formatPaise(b.remainingPaise) + ' left' : formatPaise(Math.abs(b.remainingPaise)) + ' over'}
                  </Caption1>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* Additional Insights */}
        {analytics && analytics.insights.length > 0 && (
          <Section paddedHorizontal style={{ paddingBottom: spacing[4] }}>
            <SectionHeader title="Insights" subtitle={`${analytics.insights.length} observations`} />
            <Card variant="outlined">
              {analytics.insights.map((insight, i) => (
                <TouchableOpacity
                  key={insight.type + i}
                  style={[styles.insightRow, i > 0 && { paddingTop: spacing[3], marginTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.dividerLight }]}
                  activeOpacity={0.8}
                >
                  <Row gap={spacing[3]} align="flex-start">
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: insight.severity === 'alert' ? colors.error : insight.severity === 'warning' ? colors.warning : colors.accent,
                      marginTop: 4,
                    }} />
                    <Column gap={spacing[1]} style={{ flex: 1 }}>
                      <BodyEmphasis>{insight.title}</BodyEmphasis>
                      <Caption1 color={colors.textTertiary}>{insight.description}</Caption1>
                    </Column>
                  </Row>
                </TouchableOpacity>
              ))}
            </Card>
          </Section>
        )}

        {/* Empty State */}
        {!analytics && (
          <Section paddedHorizontal style={{ paddingTop: spacing[20], paddingBottom: spacing[20] }}>
            <Card variant="subtle">
              <Section padded style={{ alignItems: 'center' }}>
                <TextPrimitive variant="displaySmall" color={colors.textTertiary} style={{ marginBottom: spacing[3] }}>📊</TextPrimitive>
                <Title2 style={{ textAlign: 'center', marginBottom: spacing[2] }}>No Data Yet</Title2>
                <Body color={colors.textTertiary} style={{ textAlign: 'center' }}>
                  Analytics will appear once you have confirmed transactions.
                </Body>
              </Section>
            </Card>
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  periodButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surface,
  },
  periodButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  periodButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  periodButtonTextActive: {
    color: colors.textOnAccent,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  legendColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  merchantRow: {
    padding: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dividerLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllButton: {
    padding: spacing[3],
    alignItems: 'center',
  },
  budgetRow: {
    padding: spacing[3],
  },
  insightRow: {
    padding: spacing[3],
  },
});