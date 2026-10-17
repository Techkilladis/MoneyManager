/**
 * Recurring payments (subscriptions, rent, recharges, EMIs).
 *
 * A recurring payment is matched to expenses by normalized merchant key. The
 * next due date is derived from the latest matching payment (or the anchor
 * date before the first one), so paying a bill moves it forward on its own.
 * Detection looks for merchants paid at a steady interval and amount.
 */
import { openDatabase, generateId, mapRecurringRow } from '../database/db';
import { Category, RecurringCadence, RecurringPayment } from '../database/schema';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { normalizeMerchantFull } from './merchantNormalization';
import { getSetting, setSetting } from './settings';
import { SPEND_WHERE } from './ledger';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CADENCE_DAYS: Record<RecurringCadence, number> = {
  WEEKLY: 7,
  MONTHLY: 30.44,
  QUARTERLY: 91.3,
  YEARLY: 365.25,
};

export const CADENCE_LABEL: Record<RecurringCadence, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Every 3 months',
  YEARLY: 'Yearly',
};

export function merchantKey(name: string): string {
  return normalizeMerchantFull(name).normalizedKey;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Adds `n` cadence periods, keeping the day of month where possible (31 Jan + 1 month = 28/29 Feb). */
export function addCadence(ts: number, cadence: RecurringCadence, n = 1): number {
  const d = new Date(ts);
  if (cadence === 'WEEKLY') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n, d.getHours(), d.getMinutes()).getTime();
  const months = cadence === 'MONTHLY' ? n : cadence === 'QUARTERLY' ? 3 * n : 12 * n;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target.getTime();
}

/**
 * Next due date given the latest matching payment. Missed periods more than
 * a few days old roll forward, so a cancelled subscription doesn't stay
 * "overdue" forever.
 */
export function nextDueDate(p: Pick<RecurringPayment, 'anchorDate' | 'cadence'>, lastPaidAt: number | null, now = Date.now()): number {
  let next = lastPaidAt && lastPaidAt >= p.anchorDate - (CADENCE_DAYS[p.cadence] / 2) * DAY_MS
    ? addCadence(lastPaidAt, p.cadence)
    : p.anchorDate;
  const graceStart = startOfDay(now) - 3 * DAY_MS;
  let guard = 0;
  while (next < graceStart && guard++ < 520) next = addCadence(next, p.cadence);
  return next;
}

const PER_MONTH: Record<RecurringCadence, number> = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };

/** Monthly cost of a recurring payment (weekly × 52/12, quarterly ÷ 3, yearly ÷ 12). */
export function monthlyEquivalent(amountPaise: number, cadence: RecurringCadence): number {
  return Math.round(amountPaise * PER_MONTH[cadence]);
}

export interface RecurringView extends RecurringPayment {
  category: Category | null;
  lastPaidAt: number | null;
  nextDueAt: number;
  daysUntilDue: number;
  paidThisPeriod: boolean;
}

interface PaymentRow {
  merchant: string;
  amountPaise: number;
  transactionTimestamp: number;
  categoryId: string | null;
}

async function recentPayments(days = 400): Promise<PaymentRow[]> {
  const db = await openDatabase();
  return db.getAllAsync<PaymentRow>(
    `SELECT merchant, amountPaise, transactionTimestamp, categoryId FROM transactions
     WHERE ${SPEND_WHERE} AND transactionTimestamp >= ? ORDER BY transactionTimestamp ASC`,
    [Date.now() - days * DAY_MS]
  );
}

function groupByMerchant(rows: PaymentRow[]): Map<string, PaymentRow[]> {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    if (!r.merchant || r.merchant === 'Unknown Merchant') continue;
    const key = merchantKey(r.merchant);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return groups;
}

export async function listRecurring(includeInactive = false): Promise<RecurringView[]> {
  const db = await openDatabase();
  const [rows, payments, categories] = await Promise.all([
    db.getAllAsync(`SELECT * FROM recurring_payments ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name ASC`),
    recentPayments(),
    categoryRepository.getAll(),
  ]);
  const groups = groupByMerchant(payments);
  const cats = new Map(categories.map((c) => [c.id, c]));
  const now = Date.now();
  const today = startOfDay(now);

  return rows
    .map((row) => {
      const p = mapRecurringRow(row);
      const history = groups.get(p.merchantKey) ?? [];
      const lastPaidAt = history.length > 0 ? history[history.length - 1].transactionTimestamp : null;
      const nextDueAt = nextDueDate(p, lastPaidAt, now);
      const periodStart = nextDueAt - CADENCE_DAYS[p.cadence] * DAY_MS;
      return {
        ...p,
        category: p.categoryId ? cats.get(p.categoryId) ?? null : null,
        lastPaidAt,
        nextDueAt,
        daysUntilDue: Math.round((startOfDay(nextDueAt) - today) / DAY_MS),
        paidThisPeriod: lastPaidAt !== null && lastPaidAt >= periodStart,
      };
    })
    .sort((a, b) => a.nextDueAt - b.nextDueAt);
}

export async function getUpcoming(days = 7): Promise<RecurringView[]> {
  const all = await listRecurring();
  return all.filter((r) => r.daysUntilDue <= days);
}

export async function findRecurringForMerchant(merchant: string): Promise<RecurringPayment | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync('SELECT * FROM recurring_payments WHERE merchant_key = ? AND is_active = 1', [
    merchantKey(merchant),
  ]);
  return row ? mapRecurringRow(row) : null;
}

export interface RecurringInput {
  name: string;
  merchant: string;
  amountPaise: number;
  cadence: RecurringCadence;
  categoryId: string | null;
  anchorDate: number;
  remind: boolean;
}

type Result = { success: boolean; error?: string; id?: string };

function validate(input: RecurringInput): string | null {
  if (!input.name.trim()) return 'Enter a name';
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) return 'Enter an amount greater than zero';
  if (!merchantKey(input.merchant || input.name)) return 'Enter the merchant name used in payments';
  return null;
}

export async function addRecurring(input: RecurringInput): Promise<Result> {
  const error = validate(input);
  if (error) return { success: false, error };
  const db = await openDatabase();
  const key = merchantKey(input.merchant || input.name);
  const dupe = await db.getFirstAsync('SELECT id FROM recurring_payments WHERE merchant_key = ? AND is_active = 1', [key]);
  if (dupe) return { success: false, error: 'This payment is already tracked' };
  const id = generateId();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO recurring_payments (id, name, merchant_key, amount_paise, cadence, category_id, anchor_date, remind, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, input.name.trim(), key, input.amountPaise, input.cadence, input.categoryId, input.anchorDate, input.remind ? 1 : 0, now, now]
  );
  return { success: true, id };
}

export async function updateRecurring(id: string, input: RecurringInput): Promise<Result> {
  const error = validate(input);
  if (error) return { success: false, error };
  const db = await openDatabase();
  await db.runAsync(
    `UPDATE recurring_payments SET name = ?, merchant_key = ?, amount_paise = ?, cadence = ?, category_id = ?, anchor_date = ?, remind = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      merchantKey(input.merchant || input.name),
      input.amountPaise,
      input.cadence,
      input.categoryId,
      input.anchorDate,
      input.remind ? 1 : 0,
      Date.now(),
      id,
    ]
  );
  return { success: true, id };
}

/** Deletes and returns the row so the caller can offer undo. */
export async function deleteRecurring(id: string): Promise<Record<string, unknown> | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM recurring_payments WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM recurring_payments WHERE id = ?', [id]);
  return row ?? null;
}

export async function restoreRecurring(row: Record<string, unknown>): Promise<void> {
  const db = await openDatabase();
  const cols = Object.keys(row);
  await db.runAsync(
    `INSERT OR REPLACE INTO recurring_payments (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => row[c] as string | number | null)
  );
}

// ------------------------------------------------------------ detection

export interface RecurringCandidate {
  merchantKey: string;
  name: string;
  amountPaise: number;
  cadence: RecurringCadence;
  categoryId: string | null;
  occurrences: number;
  lastPaidAt: number;
  nextDueAt: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function classifyInterval(days: number): RecurringCadence | null {
  if (days >= 6 && days <= 8) return 'WEEKLY';
  if (days >= 26 && days <= 35) return 'MONTHLY';
  if (days >= 84 && days <= 98) return 'QUARTERLY';
  if (days >= 350 && days <= 380) return 'YEARLY';
  return null;
}

/** Pure detection over a payment history (exported for tests). */
export function detectFromHistory(rows: PaymentRow[], now = Date.now()): RecurringCandidate[] {
  const out: RecurringCandidate[] = [];
  for (const [key, list] of groupByMerchant(rows)) {
    if (list.length < 2) continue;
    // Several payments on the same day (e.g. a split bill) count once.
    const byDay: PaymentRow[] = [];
    for (const r of list) {
      const prev = byDay[byDay.length - 1];
      if (prev && startOfDay(prev.transactionTimestamp) === startOfDay(r.transactionTimestamp)) continue;
      byDay.push(r);
    }
    if (byDay.length < 2) continue;

    const intervals = byDay.slice(1).map((r, i) => (r.transactionTimestamp - byDay[i].transactionTimestamp) / DAY_MS);
    const cadence = classifyInterval(median(intervals));
    if (!cadence) continue;
    // Weekly/monthly need three payments; quarterly/yearly can't wait that long.
    if ((cadence === 'WEEKLY' || cadence === 'MONTHLY') && byDay.length < 3) continue;
    const expected = CADENCE_DAYS[cadence];
    if (!intervals.every((d) => Math.abs(d - expected) <= expected * 0.25)) continue;

    const amounts = byDay.map((r) => r.amountPaise);
    const typical = median(amounts);
    if (!amounts.every((a) => Math.abs(a - typical) <= typical * 0.15)) continue;

    const last = byDay[byDay.length - 1];
    if (now - last.transactionTimestamp > expected * 1.5 * DAY_MS) continue; // stopped

    out.push({
      merchantKey: key,
      name: last.merchant,
      amountPaise: last.amountPaise,
      cadence,
      categoryId: last.categoryId,
      occurrences: byDay.length,
      lastPaidAt: last.transactionTimestamp,
      nextDueAt: addCadence(last.transactionTimestamp, cadence),
    });
  }
  return out.sort((a, b) => monthlyEquivalent(b.amountPaise, b.cadence) - monthlyEquivalent(a.amountPaise, a.cadence));
}

export async function detectCandidates(): Promise<RecurringCandidate[]> {
  const db = await openDatabase();
  const [payments, tracked, ignored] = await Promise.all([
    recentPayments(),
    db.getAllAsync<{ merchant_key: string }>('SELECT merchant_key FROM recurring_payments'),
    getSetting('recurringIgnored'),
  ]);
  const skip = new Set([...tracked.map((t) => t.merchant_key), ...ignored]);
  return detectFromHistory(payments).filter((c) => !skip.has(c.merchantKey));
}

export async function ignoreCandidate(key: string): Promise<void> {
  const ignored = await getSetting('recurringIgnored');
  if (!ignored.includes(key)) await setSetting('recurringIgnored', [...ignored, key]);
}

export async function acceptCandidate(c: RecurringCandidate): Promise<Result> {
  return addRecurring({
    name: c.name,
    merchant: c.name,
    amountPaise: c.amountPaise,
    cadence: c.cadence,
    categoryId: c.categoryId,
    anchorDate: c.nextDueAt,
    remind: true,
  });
}
