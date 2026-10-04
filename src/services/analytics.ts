/**
 * Analytics Service
 * 
 * Provides spending analytics using SQL aggregation for performance.
 * ONLY uses CONFIRMED transactions (status = CONFIRMED).
 * Excludes pending captures and dismissed transactions.
 */

import { transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { merchantRepository } from '../database/repositories/merchantRepository';
import { openDatabase } from '../database/db';
import { getMonthlyPeriodBounds, getWeeklyPeriodBounds } from './budget';

export interface PeriodRange {
  start: number;
  end: number;
  label: string;
}

export interface SpendingTotal {
  totalPaise: number;
  transactionCount: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  totalPaise: number;
  transactionCount: number;
  percentage: number;
}

export interface MerchantSpending {
  merchantId: string;
  merchantName: string;
  canonicalName: string;
  totalPaise: number;
  transactionCount: number;
}

export interface MemberSpending {
  memberId: string;
  memberName: string;
  memberColor: string | null;
  totalPaise: number;
  transactionCount: number;
  percentage: number;
}

export interface DailySpending {
  date: number; // Unix timestamp at start of day
  dateLabel: string;
  totalPaise: number;
  transactionCount: number;
}

export interface MonthlyComparison {
  currentMonth: SpendingTotal;
  previousMonth: SpendingTotal;
  differencePaise: number;
  differencePercent: number;
  direction: 'higher' | 'lower' | 'same';
}

export interface AnalyticsInsight {
  type: 'spending_increase' | 'spending_decrease' | 'budget_warning' | 'budget_exceeded' | 'top_category' | 'top_merchant' | 'recurring_merchant';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'alert';
  relatedData?: any;
}

/**
 * Get period boundaries for common presets
 */
export function getPeriodPreset(preset: 'today' | 'this_week' | 'this_month' | 'previous_month' | 'custom', customStart?: number, customEnd?: number): PeriodRange {
  const now = new Date();
  
  switch (preset) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return { start, end, label: 'Today' };
    }
    case 'this_week': {
      const { start, end } = getWeeklyPeriodBounds(now);
      return { start, end, label: 'This Week' };
    }
    case 'this_month': {
      const { start, end } = getMonthlyPeriodBounds(now.getFullYear(), now.getMonth());
      return { start, end, label: 'This Month' };
    }
    case 'previous_month': {
      const { start, end } = getMonthlyPeriodBounds(
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
        now.getMonth() === 0 ? 11 : now.getMonth() - 1
      );
      return { start, end, label: 'Previous Month' };
    }
    case 'custom': {
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd, label: 'Custom Range' };
      }
      return getPeriodPreset('this_month');
    }
  }
}

/**
 * Get total spending for a period (CONFIRMED only)
 */
export async function getTotalSpending(period: PeriodRange): Promise<SpendingTotal> {
  const database = await openDatabase();
  
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
    [period.start, period.end]
  );
  
  return {
    totalPaise: row?.total || 0,
    transactionCount: row?.count || 0,
  };
}

/**
 * Get spending by category for a period
 */
export async function getCategorySpending(period: PeriodRange): Promise<CategorySpending[]> {
  const database = await openDatabase();
  
  const rows = await database.getAllAsync<{
    categoryId: string;
    total: number;
    count: number;
  }>(
    `SELECT 
      t.categoryId,
      COALESCE(SUM(t.amountPaise), 0) as total,
      COUNT(*) as count
     FROM transactions t
     WHERE t.status = 'CONFIRMED'
     AND t.is_pending_capture = 0
     AND t.is_dismissed = 0
     AND t.categoryId IS NOT NULL
     AND t.transactionTimestamp >= ?
     AND t.transactionTimestamp < ?
     GROUP BY t.categoryId
     ORDER BY total DESC`,
    [period.start, period.end]
  );
  
  // Fetch category details
  const categories = await categoryRepository.getAll();
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  
  const totalPaise = rows.reduce((sum, r) => sum + r.total, 0);
  
  return rows.map(r => {
    const cat = categoryMap.get(r.categoryId);
    return {
      categoryId: r.categoryId,
      categoryName: cat?.name || 'Unknown',
      categoryIcon: cat?.icon || null,
      categoryColor: cat?.color || null,
      totalPaise: r.total,
      transactionCount: r.count,
      percentage: totalPaise > 0 ? Math.round((r.total / totalPaise) * 10000) / 100 : 0,
    };
  });
}

/**
 * Get spending by merchant for a period
 */
export async function getMerchantSpending(period: PeriodRange, limit: number = 10): Promise<MerchantSpending[]> {
  const database = await openDatabase();
  
  const rows = await database.getAllAsync<{
    merchant: string;
    total: number;
    count: number;
  }>(
    `SELECT 
      t.merchant,
      COALESCE(SUM(t.amountPaise), 0) as total,
      COUNT(*) as count
     FROM transactions t
     WHERE t.status = 'CONFIRMED'
     AND t.is_pending_capture = 0
     AND t.is_dismissed = 0
     AND t.transactionTimestamp >= ?
     AND t.transactionTimestamp < ?
     GROUP BY t.merchant
     ORDER BY total DESC
     LIMIT ?`,
    [period.start, period.end, limit]
  );
  
  // Try to get merchant entities for canonical names
  const merchantNames = rows.map(r => r.merchant);
  const merchants = await Promise.all(
    merchantNames.map(name => merchantRepository.getByNormalizedKey(name.toLowerCase().trim()))
  );
  const merchantMap = new Map(
    merchantNames.map((name, i) => [name, merchants[i]])
  );
  
  return rows.map(r => {
    const merchant = merchantMap.get(r.merchant);
    return {
      merchantId: merchant?.id || 'unknown',
      merchantName: r.merchant,
      canonicalName: merchant?.canonicalName || r.merchant,
      totalPaise: r.total,
      transactionCount: r.count,
    };
  });
}

/**
 * Get spending by member for a period
 */
export async function getMemberSpending(period: PeriodRange): Promise<MemberSpending[]> {
  const database = await openDatabase();
  
  const rows = await database.getAllAsync<{
    memberId: string;
    total: number;
    count: number;
  }>(
    `SELECT 
      t.memberId,
      COALESCE(SUM(t.amountPaise), 0) as total,
      COUNT(*) as count
     FROM transactions t
     WHERE t.status = 'CONFIRMED'
     AND t.is_pending_capture = 0
     AND t.is_dismissed = 0
     AND t.memberId IS NOT NULL
     AND t.transactionTimestamp >= ?
     AND t.transactionTimestamp < ?
     GROUP BY t.memberId
     ORDER BY total DESC`,
    [period.start, period.end]
  );
  
  const members = await memberRepository.getAll();
  const memberMap = new Map(members.map(m => [m.id, m]));
  
  const totalPaise = rows.reduce((sum, r) => sum + r.total, 0);
  
  return rows.map(r => {
    const mem = memberMap.get(r.memberId);
    return {
      memberId: r.memberId,
      memberName: mem?.name || 'Unknown',
      memberColor: mem?.color || null,
      totalPaise: r.total,
      transactionCount: r.count,
      percentage: totalPaise > 0 ? Math.round((r.total / totalPaise) * 10000) / 100 : 0,
    };
  });
}

/**
 * Get daily spending trend for a period
 */
export async function getDailySpendingTrend(period: PeriodRange): Promise<DailySpending[]> {
  const database = await openDatabase();
  
  const rows = await database.getAllAsync<{
    day: number;
    total: number;
    count: number;
  }>(
    `SELECT 
      (transactionTimestamp / 86400000) * 86400000 as day,
      COALESCE(SUM(amountPaise), 0) as total,
      COUNT(*) as count
     FROM transactions
     WHERE status = 'CONFIRMED'
     AND is_pending_capture = 0
     AND is_dismissed = 0
     AND transactionTimestamp >= ?
     AND transactionTimestamp < ?
     GROUP BY day
     ORDER BY day ASC`,
    [period.start, period.end]
  );
  
  return rows.map(r => ({
    date: r.day,
    dateLabel: new Date(r.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    totalPaise: r.total,
    transactionCount: r.count,
  }));
}

/**
 * Get uncategorized spending for a period
 */
export async function getUncategorizedSpending(period: PeriodRange): Promise<SpendingTotal> {
  const database = await openDatabase();
  
  const row = await database.getFirstAsync<{ total: number; count: number }>(
    `SELECT 
      COALESCE(SUM(amountPaise), 0) as total,
      COUNT(*) as count
     FROM transactions
     WHERE status = 'CONFIRMED'
     AND is_pending_capture = 0
     AND is_dismissed = 0
     AND categoryId IS NULL
     AND transactionTimestamp >= ?
     AND transactionTimestamp < ?`,
    [period.start, period.end]
  );
  
  return {
    totalPaise: row?.total || 0,
    transactionCount: row?.count || 0,
  };
}

/**
 * Get monthly comparison
 */
export async function getMonthlyComparison(): Promise<MonthlyComparison> {
  const currentPeriod = getPeriodPreset('this_month');
  const previousPeriod = getPeriodPreset('previous_month');
  
  const [current, previous] = await Promise.all([
    getTotalSpending(currentPeriod),
    getTotalSpending(previousPeriod),
  ]);
  
  const differencePaise = current.totalPaise - previous.totalPaise;
  const differencePercent = previous.totalPaise > 0
    ? Math.round((differencePaise / previous.totalPaise) * 10000) / 100
    : 0;
  
  let direction: 'higher' | 'lower' | 'same' = 'same';
  if (differencePaise > 0) direction = 'higher';
  else if (differencePaise < 0) direction = 'lower';
  
  return {
    currentMonth: current,
    previousMonth: previous,
    differencePaise,
    differencePercent: Math.abs(differencePercent),
    direction,
  };
}

/**
 * Generate deterministic insights from analytics data
 */
export async function generateInsights(period: PeriodRange): Promise<AnalyticsInsight[]> {
  const insights: AnalyticsInsight[] = [];
  
  // Get data needed for insights
  const [totalSpending, categorySpending, merchantSpending, monthlyComparison] = await Promise.all([
    getTotalSpending(period),
    getCategorySpending(period),
    getMerchantSpending(period, 5),
    getMonthlyComparison(),
  ]);
  
  // 1. Monthly comparison insight
  if (monthlyComparison.direction !== 'same') {
    const directionText = monthlyComparison.direction === 'higher' ? 'more' : 'less';
    const absPercent = monthlyComparison.differencePercent;
    
    insights.push({
      type: monthlyComparison.direction === 'higher' ? 'spending_increase' : 'spending_decrease',
      title: `Spending ${monthlyComparison.direction === 'higher' ? 'increased' : 'decreased'}`,
      description: `You spent ₹${Math.abs(monthlyComparison.differencePaise) / 100} ${directionText} than last month (${absPercent}%)`,
      severity: monthlyComparison.direction === 'higher' ? 'warning' : 'info',
      relatedData: { differencePaise: monthlyComparison.differencePaise, percent: absPercent },
    });
  }
  
  // 2. Top category insight
  if (categorySpending.length > 0) {
    const top = categorySpending[0];
    insights.push({
      type: 'top_category',
      title: 'Top spending category',
      description: `${top.categoryName} is your largest category at ${top.percentage}% (₹${top.totalPaise / 100})`,
      severity: 'info',
      relatedData: { categoryId: top.categoryId, percentage: top.percentage },
    });
  }
  
  // 3. Top merchant insight
  if (merchantSpending.length > 0) {
    const top = merchantSpending[0];
    insights.push({
      type: 'top_merchant',
      title: 'Most frequent merchant',
      description: `${top.canonicalName}: ${top.transactionCount} transactions, ₹${top.totalPaise / 100} total`,
      severity: 'info',
      relatedData: { merchantId: top.merchantId, count: top.transactionCount },
    });
  }
  
  // 4. Recurring merchant detection (3+ transactions in period)
  const recurring = merchantSpending.filter(m => m.transactionCount >= 3);
  if (recurring.length > 0) {
    insights.push({
      type: 'recurring_merchant',
      title: 'Recurring merchants',
      description: `${recurring.length} merchant${recurring.length > 1 ? 's' : ''} with 3+ transactions this period`,
      severity: 'info',
      relatedData: { merchants: recurring.map(m => ({ name: m.canonicalName, count: m.transactionCount })) },
    });
  }
  
  // Note: Budget warnings are handled by BudgetService and surfaced separately
  
  return insights;
}

/**
 * Get complete analytics for a period
 */
export async function getAnalytics(period: PeriodRange): Promise<{
  total: SpendingTotal;
  categories: CategorySpending[];
  merchants: MerchantSpending[];
  members: MemberSpending[];
  dailyTrend: DailySpending[];
  uncategorized: SpendingTotal;
  monthlyComparison: MonthlyComparison;
  insights: AnalyticsInsight[];
}> {
  const [
    total,
    categories,
    merchants,
    members,
    dailyTrend,
    uncategorized,
    monthlyComparison,
    insights,
  ] = await Promise.all([
    getTotalSpending(period),
    getCategorySpending(period),
    getMerchantSpending(period, 10),
    getMemberSpending(period),
    getDailySpendingTrend(period),
    getUncategorizedSpending(period),
    getMonthlyComparison(),
    generateInsights(period),
  ]);
  
  return {
    total,
    categories,
    merchants,
    members,
    dailyTrend,
    uncategorized,
    monthlyComparison,
    insights,
  };
}