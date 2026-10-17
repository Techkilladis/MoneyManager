/**
 * Monthly recap: a one-screen summary of a finished month (shown on Home
 * during the first week of the next month and from the 1st-of-month
 * notification).
 */
import { openDatabase } from '../database/db';
import { FormattedTransaction } from '../domain/transaction';
import {
  CategoryShare,
  getCategoryShares,
  getLargestExpense,
  incomeBetween,
  savingsRate,
  SPEND_AMOUNT,
  SPEND_WHERE,
  sumBetween,
} from './ledger';
import { getMonthlyBudgets } from './budget';
import { getSetting, setSetting } from './settings';
import { formatINR } from '../utils/format';

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year: Number(m[1]), month };
}

export function previousMonthKey(date = new Date()): string {
  return monthKeyOf(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export interface MonthlyRecap {
  monthKey: string;
  label: string; // "October 2026"
  monthName: string; // "October"
  start: number;
  end: number;
  spent: number;
  count: number;
  previousSpent: number;
  /** Change vs the previous month (0.12 = 12% more), null without a baseline. */
  change: number | null;
  income: number;
  saved: number;
  savingsRate: number | null;
  categories: CategoryShare[];
  topMerchant: { name: string; total: number; count: number } | null;
  biggest: FormattedTransaction | null;
  noSpendDays: number;
  daysCounted: number;
  dailyAverage: number;
  budgets: { total: number; within: number };
}

export async function getMonthlyRecap(key: string): Promise<MonthlyRecap | null> {
  const parsed = parseMonthKey(key);
  if (!parsed) return null;
  const { year, month } = parsed;
  const startDate = new Date(year, month, 1);
  const start = startDate.getTime();
  const end = new Date(year, month + 1, 1).getTime();
  const prevStart = new Date(year, month - 1, 1).getTime();
  const now = Date.now();
  const db = await openDatabase();

  const [spend, prev, income, categories, biggest, merchantRow, dayRow, budgets] = await Promise.all([
    sumBetween(start, end),
    sumBetween(prevStart, start),
    incomeBetween(start, end),
    getCategoryShares(start, end),
    getLargestExpense(start, end),
    db.getFirstAsync<{ merchant: string; total: number; count: number }>(
      `SELECT merchant, SUM(${SPEND_AMOUNT}) AS total, COUNT(*) AS count FROM transactions
       WHERE ${SPEND_WHERE} AND transactionTimestamp >= ? AND transactionTimestamp < ? AND merchant != 'Unknown Merchant'
       GROUP BY merchant ORDER BY total DESC LIMIT 1`,
      [start, end]
    ),
    db.getFirstAsync<{ days: number }>(
      `SELECT COUNT(DISTINCT strftime('%Y-%m-%d', transactionTimestamp / 1000, 'unixepoch', 'localtime')) AS days
       FROM transactions WHERE ${SPEND_WHERE} AND transactionTimestamp >= ? AND transactionTimestamp < ?`,
      [start, end]
    ),
    getMonthlyBudgets(startDate),
  ]);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysCounted = Math.max(1, Math.round((Math.min(end, now) - start) / msPerDay));
  const spendDays = dayRow?.days ?? 0;

  return {
    monthKey: key,
    label: startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    monthName: startDate.toLocaleDateString('en-IN', { month: 'long' }),
    start,
    end,
    spent: spend.total,
    count: spend.count,
    previousSpent: prev.total,
    change: prev.total > 0 ? (spend.total - prev.total) / prev.total : null,
    income: income.total,
    saved: income.total - spend.total,
    savingsRate: savingsRate(income.total, spend.total),
    categories: categories.slice(0, 5),
    topMerchant: merchantRow ? { name: merchantRow.merchant, total: merchantRow.total, count: merchantRow.count } : null,
    biggest,
    noSpendDays: Math.max(0, daysCounted - spendDays),
    daysCounted,
    dailyAverage: Math.round(spend.total / daysCounted),
    budgets: {
      total: budgets.length,
      within: budgets.filter((b) => b.spentPaise <= b.budget.amountPaise).length,
    },
  };
}

/**
 * The recap card shows on Home for the first week of a month, for last month,
 * when last month had spending and the card wasn't dismissed.
 */
export async function getRecapCard(date = new Date()): Promise<MonthlyRecap | null> {
  if (date.getDate() > 7) return null;
  const key = previousMonthKey(date);
  const dismissed = await getSetting('recapDismissed');
  if (dismissed.includes(key)) return null;
  const recap = await getMonthlyRecap(key);
  return recap && recap.count > 0 ? recap : null;
}

export async function dismissRecapCard(key: string): Promise<void> {
  const dismissed = await getSetting('recapDismissed');
  await setSetting('recapDismissed', [...dismissed.filter((k) => k >= previousMonthKey(new Date(2000, 0, 1))).slice(-11), key]);
}

/** One-line headline, e.g. "You spent 12% less than in September." */
export function recapHeadline(r: MonthlyRecap): string {
  if (r.change === null) return `You spent ${formatINR(r.spent, { decimals: 'never' })} in ${r.monthName}.`;
  const pct = Math.round(Math.abs(r.change) * 100);
  const prevName = new Date(new Date(r.start).getFullYear(), new Date(r.start).getMonth() - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
  });
  if (pct < 1) return `You spent about the same as in ${prevName}.`;
  return r.change < 0 ? `You spent ${pct}% less than in ${prevName}.` : `You spent ${pct}% more than in ${prevName}.`;
}

export function recapShareText(r: MonthlyRecap): string {
  const lines = [
    `My ${r.label} money recap`,
    `Spent: ${formatINR(r.spent, { decimals: 'never' })} across ${r.count} expenses`,
    recapHeadline(r),
  ];
  if (r.income > 0) {
    lines.push(`Saved: ${formatINR(Math.max(0, r.saved), { decimals: 'never' })}${r.savingsRate !== null && r.savingsRate > 0 ? ` (${Math.round(r.savingsRate * 100)}% of income)` : ''}`);
  }
  if (r.categories[0]) lines.push(`Top category: ${r.categories[0].name} (${Math.round(r.categories[0].share * 100)}%)`);
  lines.push(`No-spend days: ${r.noSpendDays}`);
  lines.push('— Money Manager');
  return lines.join('\n');
}
