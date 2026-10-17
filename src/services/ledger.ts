/**
 * Ledger queries that back the redesigned screens: home summary, paged
 * history, spending series, recent merchants, CSV export and data reset.
 *
 * "Spending" means confirmed, non-pending, non-dismissed EXPENSE rows, and
 * counts only your share of split bills (amount minus what others owe you).
 * "Income" is the same filter on INCOME rows.
 */
import { openDatabase } from '../database/db';
import { Category, Member, Transaction } from '../database/schema';
import { mapTransactionRow } from '../database/db';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { FormattedTransaction, formatDate } from '../domain/transaction';
import { formatCurrency } from '../database/db';
import { notificationDetectionService } from './notificationDetection';
import { getMonthlyBudgets } from './budget';
import { getSetting } from './settings';

/** Settled rows of either kind (what History lists). */
export const SETTLED_WHERE = "status = 'CONFIRMED' AND is_pending_capture = 0 AND is_dismissed = 0";
export const SPEND_WHERE = `${SETTLED_WHERE} AND kind = 'EXPENSE'`;
export const INCOME_WHERE = `${SETTLED_WHERE} AND kind = 'INCOME'`;
/** Your share of an expense: the full amount minus what others owe you back. */
export const SPEND_AMOUNT = '(amountPaise - shared_paise)';

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------ formatting

type Lookup = { categories: Map<string, Category>; members: Map<string, Member> };

async function loadLookup(): Promise<Lookup> {
  const [cats, mems] = await Promise.all([categoryRepository.getAll(), memberRepository.getAll()]);
  return {
    categories: new Map(cats.map((c) => [c.id, c])),
    members: new Map(mems.map((m) => [m.id, m])),
  };
}

export function toFormatted(tx: Transaction, lookup: Lookup): FormattedTransaction {
  const { date, time } = formatDate(tx.transactionTimestamp);
  const category = tx.categoryId ? lookup.categories.get(tx.categoryId) : undefined;
  const member = tx.memberId ? lookup.members.get(tx.memberId) : undefined;
  return {
    id: tx.id,
    amount: formatCurrency(tx.amountPaise, tx.currency),
    amountPaise: tx.amountPaise,
    currency: tx.currency,
    merchant: tx.merchant,
    date,
    time,
    timestamp: tx.transactionTimestamp,
    category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : null,
    member: member ? { id: member.id, name: member.name, color: member.color } : null,
    note: tx.note,
    status: tx.status,
    sourceApp: tx.sourceApp,
    sourceEventId: tx.sourceEventId,
    sourceType: tx.sourceType,
    is_pending_capture: tx.is_pending_capture ?? 0,
    is_dismissed: tx.is_dismissed ?? 0,
    dismissed_at: tx.dismissed_at ?? null,
    kind: tx.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
    sharedPaise: tx.sharedPaise ?? 0,
  };
}

async function formatRows(rows: unknown[]): Promise<FormattedTransaction[]> {
  if (rows.length === 0) return [];
  const lookup = await loadLookup();
  return rows.map((r) => toFormatted(mapTransactionRow(r), lookup));
}

// ------------------------------------------------------------ periods

export function monthBounds(date = new Date()): { start: number; end: number } {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
  };
}

/** Monday-start week containing `date`. */
export function weekBounds(date = new Date()): { start: number; end: number } {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff).getTime();
  return { start, end: new Date(start).setDate(new Date(start).getDate() + 7) };
}

export async function sumBetween(start: number, end: number): Promise<{ total: number; count: number }> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(${SPEND_AMOUNT}), 0) AS total, COUNT(*) AS count
     FROM transactions WHERE ${SPEND_WHERE} AND transactionTimestamp >= ? AND transactionTimestamp < ?`,
    [start, end]
  );
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

export async function incomeBetween(start: number, end: number): Promise<{ total: number; count: number }> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amountPaise), 0) AS total, COUNT(*) AS count
     FROM transactions WHERE ${INCOME_WHERE} AND transactionTimestamp >= ? AND transactionTimestamp < ?`,
    [start, end]
  );
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

/** Share of income kept (0..1), or null when there was no income. */
export function savingsRate(income: number, spent: number): number | null {
  if (income <= 0) return null;
  return (income - spent) / income;
}

// ------------------------------------------------------------ home

export interface CategoryShare {
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  totalPaise: number;
  count: number;
  share: number; // 0..1 of the period total
}

export interface HomeSummary {
  monthTotal: number;
  monthCount: number;
  /** Spend over the same number of days at the start of last month. */
  lastMonthToDate: number;
  lastMonthTotal: number;
  todayTotal: number;
  weekTotal: number;
  dailyAverage: number;
  topCategories: CategoryShare[];
  recent: FormattedTransaction[];
  pending: FormattedTransaction[];
  pendingTotal: number;
  /** Overall monthly budget if set, otherwise the sum of category budgets. */
  budget: { limit: number; spent: number; count: number; overall: boolean } | null;
  hasAnyTransactions: boolean;
  monthIncome: number;
  /** Income minus spending this month. */
  monthLeft: number;
  savingsRate: number | null;
}

export async function getCategoryShares(
  start: number,
  end: number,
  kind: 'EXPENSE' | 'INCOME' = 'EXPENSE'
): Promise<CategoryShare[]> {
  const db = await openDatabase();
  const where = kind === 'INCOME' ? INCOME_WHERE : SPEND_WHERE;
  const amount = kind === 'INCOME' ? 'amountPaise' : SPEND_AMOUNT;
  const rows = await db.getAllAsync<{ categoryId: string | null; total: number; count: number }>(
    `SELECT categoryId, SUM(${amount}) AS total, COUNT(*) AS count
     FROM transactions WHERE ${where} AND transactionTimestamp >= ? AND transactionTimestamp < ?
     GROUP BY categoryId HAVING total > 0 ORDER BY total DESC`,
    [start, end]
  );
  const total = rows.reduce((s, r) => s + r.total, 0);
  const lookup = await loadLookup();
  return rows.map((r) => {
    const cat = r.categoryId ? lookup.categories.get(r.categoryId) : undefined;
    return {
      categoryId: r.categoryId,
      name: cat?.name ?? 'Uncategorized',
      icon: cat?.icon ?? null,
      color: cat?.color ?? '#9CA3AF',
      totalPaise: r.total,
      count: r.count,
      share: total > 0 ? r.total / total : 0,
    };
  });
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const db = await openDatabase();
  const now = new Date();
  const month = monthBounds(now);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const elapsed = now.getTime() - month.start;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const week = weekBounds(now);

  const [monthAgg, prevToDate, prevFull, today, weekAgg, categories, recentRows, pendingRows, anyRow, budgets, income, overall] =
    await Promise.all([
      sumBetween(month.start, month.end),
      sumBetween(prevMonthStart, Math.min(prevMonthStart + elapsed, month.start)),
      sumBetween(prevMonthStart, month.start),
      sumBetween(todayStart, todayStart + DAY_MS),
      sumBetween(week.start, week.end),
      getCategoryShares(month.start, month.end),
      db.getAllAsync(`SELECT * FROM transactions WHERE ${SETTLED_WHERE} ORDER BY transactionTimestamp DESC LIMIT 6`),
      db.getAllAsync(
        `SELECT * FROM transactions WHERE status = 'PENDING' AND is_pending_capture = 1 AND is_dismissed = 0
         ORDER BY transactionTimestamp DESC`
      ),
      db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transactions WHERE is_dismissed = 0 AND (is_pending_capture = 1 OR ${SETTLED_WHERE})`
      ),
      getMonthlyBudgets(now),
      incomeBetween(month.start, month.end),
      getSetting('overallBudgetPaise').catch(() => 0),
    ]);

  const [recent, pending] = await Promise.all([formatRows(recentRows), formatRows(pendingRows)]);
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - month.start) / DAY_MS));

  return {
    monthTotal: monthAgg.total,
    monthCount: monthAgg.count,
    lastMonthToDate: prevToDate.total,
    lastMonthTotal: prevFull.total,
    todayTotal: today.total,
    weekTotal: weekAgg.total,
    dailyAverage: Math.round(monthAgg.total / daysElapsed),
    topCategories: categories,
    recent,
    pending,
    pendingTotal: pending.reduce((s, t) => s + t.amountPaise, 0),
    budget:
      overall > 0
        ? { limit: overall, spent: monthAgg.total, count: budgets.length, overall: true }
        : budgets.length > 0
          ? {
              limit: budgets.reduce((s, b) => s + b.budget.amountPaise, 0),
              spent: budgets.reduce((s, b) => s + b.spentPaise, 0),
              count: budgets.length,
              overall: false,
            }
          : null,
    hasAnyTransactions: (anyRow?.n ?? 0) > 0,
    monthIncome: income.total,
    monthLeft: income.total - monthAgg.total,
    savingsRate: savingsRate(income.total, monthAgg.total),
  };
}

// ------------------------------------------------------------ history

export interface HistoryFilters {
  /** undefined = both expenses and income */
  kind?: 'EXPENSE' | 'INCOME';
  search?: string;
  categoryId?: string | null; // 'none' = uncategorized
  memberId?: string | null;
  start?: number;
  end?: number;
}

function historyWhere(f: HistoryFilters): { sql: string; params: (string | number)[] } {
  const parts = [SETTLED_WHERE];
  const params: (string | number)[] = [];
  if (f.kind) {
    parts.push('kind = ?');
    params.push(f.kind);
  }
  if (f.search && f.search.trim()) {
    parts.push('(merchant LIKE ? OR note LIKE ?)');
    const q = `%${f.search.trim()}%`;
    params.push(q, q);
  }
  if (f.categoryId === 'none') parts.push('categoryId IS NULL');
  else if (f.categoryId) {
    parts.push('categoryId = ?');
    params.push(f.categoryId);
  }
  if (f.memberId) {
    parts.push('memberId = ?');
    params.push(f.memberId);
  }
  if (f.start !== undefined) {
    parts.push('transactionTimestamp >= ?');
    params.push(f.start);
  }
  if (f.end !== undefined) {
    parts.push('transactionTimestamp < ?');
    params.push(f.end);
  }
  return { sql: parts.join(' AND '), params };
}

export async function getHistoryPage(
  filters: HistoryFilters,
  limit: number,
  offset: number
): Promise<FormattedTransaction[]> {
  const db = await openDatabase();
  const { sql, params } = historyWhere(filters);
  const rows = await db.getAllAsync(
    `SELECT * FROM transactions WHERE ${sql} ORDER BY transactionTimestamp DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return formatRows(rows);
}

const SPENT_SUM = `COALESCE(SUM(CASE WHEN kind = 'EXPENSE' THEN ${SPEND_AMOUNT} ELSE 0 END), 0)`;
const INCOME_SUM = "COALESCE(SUM(CASE WHEN kind = 'INCOME' THEN amountPaise ELSE 0 END), 0)";

/** `total` is spending (your share); `income` is money in. */
export async function getHistoryTotals(
  filters: HistoryFilters
): Promise<{ total: number; income: number; count: number }> {
  const db = await openDatabase();
  const { sql, params } = historyWhere(filters);
  const row = await db.getFirstAsync<{ total: number; income: number; count: number }>(
    `SELECT ${SPENT_SUM} AS total, ${INCOME_SUM} AS income, COUNT(*) AS count FROM transactions WHERE ${sql}`,
    params
  );
  return { total: row?.total ?? 0, income: row?.income ?? 0, count: row?.count ?? 0 };
}

export interface DayTotal {
  spent: number;
  income: number;
}

/** Per-day totals for the given filters, keyed by local start-of-day. */
export async function getDailyTotals(filters: HistoryFilters): Promise<Map<number, DayTotal>> {
  const db = await openDatabase();
  const { sql, params } = historyWhere(filters);
  const rows = await db.getAllAsync<{ day: string; spent: number; income: number }>(
    `SELECT strftime('%Y-%m-%d', transactionTimestamp / 1000, 'unixepoch', 'localtime') AS day,
            ${SPENT_SUM} AS spent, ${INCOME_SUM} AS income
     FROM transactions WHERE ${sql} GROUP BY day`,
    params
  );
  const map = new Map<number, DayTotal>();
  for (const r of rows) {
    const [y, m, d] = r.day.split('-').map(Number);
    map.set(new Date(y, m - 1, d).getTime(), { spent: r.spent, income: r.income });
  }
  return map;
}

// ------------------------------------------------------------ series

export interface SeriesPoint {
  start: number;
  label: string;
  totalPaise: number;
}

/** Spending per local day or month between start (inclusive) and end (exclusive), gaps filled with 0. */
export async function getSpendingSeries(start: number, end: number, bucket: 'day' | 'month'): Promise<SeriesPoint[]> {
  const db = await openDatabase();
  const fmt = bucket === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const rows = await db.getAllAsync<{ k: string; total: number }>(
    `SELECT strftime('${fmt}', transactionTimestamp / 1000, 'unixepoch', 'localtime') AS k, SUM(${SPEND_AMOUNT}) AS total
     FROM transactions WHERE ${SPEND_WHERE} AND transactionTimestamp >= ? AND transactionTimestamp < ?
     GROUP BY k`,
    [start, end]
  );
  const totals = new Map(rows.map((r) => [r.k, r.total]));
  const pad = (n: number) => String(n).padStart(2, '0');
  const points: SeriesPoint[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() < end && points.length < 400) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    if (bucket === 'day') {
      const d = cursor.getDate();
      points.push({
        start: cursor.getTime(),
        label: String(d),
        totalPaise: totals.get(`${y}-${pad(m + 1)}-${pad(d)}`) ?? 0,
      });
      cursor.setDate(d + 1);
    } else {
      points.push({
        start: cursor.getTime(),
        label: cursor.toLocaleDateString('en-IN', { month: 'short' }),
        totalPaise: totals.get(`${y}-${pad(m + 1)}`) ?? 0,
      });
      cursor.setMonth(m + 1, 1);
    }
  }
  return points;
}

export async function getLargestExpense(start: number, end: number): Promise<FormattedTransaction | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync(
    `SELECT * FROM transactions WHERE ${SPEND_WHERE} AND transactionTimestamp >= ? AND transactionTimestamp < ?
     ORDER BY ${SPEND_AMOUNT} DESC LIMIT 1`,
    [start, end]
  );
  if (!row) return null;
  const [tx] = await formatRows([row]);
  return tx ?? null;
}

// ------------------------------------------------------------ merchants

export async function getRecentMerchants(limit = 8): Promise<string[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{ merchant: string }>(
    `SELECT merchant FROM transactions
     WHERE is_dismissed = 0 AND merchant != 'Unknown Merchant'
     GROUP BY merchant ORDER BY MAX(transactionTimestamp) DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => r.merchant);
}

// ------------------------------------------------------------ export / reset

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportTransactionsCsv(): Promise<{ csv: string; count: number }> {
  const db = await openDatabase();
  const rows = await db.getAllAsync(`SELECT * FROM transactions WHERE ${SETTLED_WHERE} ORDER BY transactionTimestamp DESC`);
  const lookup = await loadLookup();
  const pad = (n: number) => String(n).padStart(2, '0');

  const lines = [
    ['Date', 'Time', 'Type', 'Merchant', 'Amount (INR)', 'Your share (INR)', 'Category', 'Member', 'Note', 'Source'].join(','),
  ];
  for (const raw of rows) {
    const tx = mapTransactionRow(raw);
    const d = new Date(tx.transactionTimestamp);
    lines.push(
      [
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        tx.kind === 'INCOME' ? 'Income' : 'Expense',
        tx.merchant,
        (tx.amountPaise / 100).toFixed(2),
        ((tx.amountPaise - (tx.kind === 'INCOME' ? 0 : tx.sharedPaise)) / 100).toFixed(2),
        tx.categoryId ? lookup.categories.get(tx.categoryId)?.name ?? '' : '',
        tx.memberId ? lookup.members.get(tx.memberId)?.name ?? '' : '',
        tx.note ?? '',
        tx.sourceApp ?? '',
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return { csv: lines.join('\n'), count: rows.length };
}

/**
 * Deletes every transaction, budget and learned merchant mapping.
 * Categories and members are kept. Pending native events are dismissed
 * first so they don't reappear as captures on the next sync.
 */
export async function clearAllData(): Promise<void> {
  try {
    const events = await notificationDetectionService.getPendingUpiEvents();
    for (const e of events) {
      await notificationDetectionService.dismissPendingUpiEvent(e.id).catch(() => undefined);
    }
  } catch {
    // Native module unavailable — nothing to dismiss.
  }

  const db = await openDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM splits;');
    await db.execAsync('DELETE FROM recurring_payments;');
    await db.execAsync('DELETE FROM transactions;');
    await db.execAsync('DELETE FROM merchant_memory;');
    await db.execAsync('DELETE FROM merchants;');
    await db.execAsync('DELETE FROM budgets;');
  });
}
