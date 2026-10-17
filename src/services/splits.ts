/**
 * Split expenses. When you pay for something shared, the other people's
 * shares are recorded as splits: they are money owed back to you, so your
 * spending counts only your share (`transactions.shared_paise` holds the
 * total others owe). Settling a split doesn't change spending; it only marks
 * that the money came back.
 */
import { openDatabase, generateId, mapSplitRow } from '../database/db';
import { Member, Split } from '../database/schema';
import { memberRepository } from '../database/repositories/memberRepository';

export const SELF_MEMBER_ID = 'member-self';

export interface SplitShare {
  memberId: string;
  sharePaise: number;
}

export interface SplitView extends Split {
  member: Member | null;
}

type Result = { success: boolean; error?: string };

/**
 * Divides `amountPaise` equally between the given people (and you, when
 * `includeSelf`). Leftover paise go to the first people so shares always add
 * up exactly; your own share is never the one rounded up.
 */
export function equalShares(amountPaise: number, memberIds: string[], includeSelf = true): SplitShare[] {
  const ids = memberIds.filter((id) => id !== SELF_MEMBER_ID);
  const people = ids.length + (includeSelf ? 1 : 0);
  if (people === 0 || amountPaise <= 0) return [];
  const base = Math.floor(amountPaise / people);
  let remainder = amountPaise - base * people;
  return ids.map((memberId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { memberId, sharePaise: base + extra };
  });
}

export function validateShares(amountPaise: number, shares: SplitShare[]): string | null {
  const seen = new Set<string>();
  let total = 0;
  for (const s of shares) {
    if (s.memberId === SELF_MEMBER_ID) return "Your own share isn't a split";
    if (seen.has(s.memberId)) return 'Each person can only appear once';
    if (!Number.isInteger(s.sharePaise) || s.sharePaise <= 0) return 'Every share must be more than zero';
    seen.add(s.memberId);
    total += s.sharePaise;
  }
  if (total > amountPaise) return "Shares can't add up to more than the amount paid";
  return null;
}

export async function getSplits(transactionId: string): Promise<SplitView[]> {
  const db = await openDatabase();
  const [rows, members] = await Promise.all([
    db.getAllAsync('SELECT * FROM splits WHERE transaction_id = ? ORDER BY created_at ASC', [transactionId]),
    memberRepository.getAll(),
  ]);
  const byId = new Map(members.map((m) => [m.id, m]));
  return rows.map((r) => {
    const split = mapSplitRow(r);
    return { ...split, member: byId.get(split.memberId) ?? null };
  });
}

/** Replaces the splits on an expense. Settled status is kept for people who stay on it. */
export async function setSplits(transactionId: string, shares: SplitShare[]): Promise<Result> {
  const db = await openDatabase();
  const tx = await db.getFirstAsync<{ amountPaise: number; kind: string }>(
    'SELECT amountPaise, kind FROM transactions WHERE id = ?',
    [transactionId]
  );
  if (!tx) return { success: false, error: 'Expense not found' };
  if (tx.kind === 'INCOME') return { success: false, error: "Income can't be split" };
  const error = validateShares(tx.amountPaise, shares);
  if (error) return { success: false, error };

  const existing = (await db.getAllAsync('SELECT * FROM splits WHERE transaction_id = ?', [transactionId])).map(mapSplitRow);
  const settled = new Map(existing.map((s) => [s.memberId, s.settledAt]));
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM splits WHERE transaction_id = ?', [transactionId]);
    for (const s of shares) {
      await db.runAsync(
        'INSERT INTO splits (id, transaction_id, member_id, share_paise, settled_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), transactionId, s.memberId, s.sharePaise, settled.get(s.memberId) ?? null, now]
      );
    }
    await db.runAsync('UPDATE transactions SET shared_paise = ?, updatedAt = ? WHERE id = ?', [
      shares.reduce((sum, s) => sum + s.sharePaise, 0),
      now,
      transactionId,
    ]);
  });
  return { success: true };
}

/** Keeps shares proportional when an expense's amount is edited. */
export async function rescaleSplits(transactionId: string, oldAmount: number, newAmount: number): Promise<void> {
  if (oldAmount <= 0 || oldAmount === newAmount) return;
  const db = await openDatabase();
  const existing = (await db.getAllAsync('SELECT * FROM splits WHERE transaction_id = ?', [transactionId])).map(mapSplitRow);
  if (existing.length === 0) return;
  const scaled = existing.map((s) => ({
    memberId: s.memberId,
    sharePaise: Math.max(1, Math.round((s.sharePaise * newAmount) / oldAmount)),
  }));
  let total = scaled.reduce((sum, s) => sum + s.sharePaise, 0);
  // Rounding can push the total over the new amount; trim from the largest share.
  while (total > newAmount && scaled.length > 0) {
    const largest = scaled.reduce((a, b) => (b.sharePaise > a.sharePaise ? b : a));
    if (largest.sharePaise <= 1) break;
    largest.sharePaise -= 1;
    total -= 1;
  }
  await setSplits(transactionId, scaled.filter((s) => s.sharePaise > 0));
}

export async function setSplitSettled(splitId: string, settled: boolean): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('UPDATE splits SET settled_at = ? WHERE id = ?', [settled ? Date.now() : null, splitId]);
}

/** Marks everything a person owes you as paid back. Returns the split ids changed (for undo). */
export async function settleMember(memberId: string): Promise<string[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM splits WHERE member_id = ? AND settled_at IS NULL',
    [memberId]
  );
  await db.runAsync('UPDATE splits SET settled_at = ? WHERE member_id = ? AND settled_at IS NULL', [Date.now(), memberId]);
  return rows.map((r) => r.id);
}

export async function unsettleSplits(splitIds: string[]): Promise<void> {
  if (splitIds.length === 0) return;
  const db = await openDatabase();
  const marks = splitIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE splits SET settled_at = NULL WHERE id IN (${marks})`, splitIds);
}

export interface OwedItem {
  splitId: string;
  transactionId: string;
  merchant: string;
  timestamp: number;
  sharePaise: number;
}

export interface MemberBalance {
  member: Member;
  owedPaise: number;
  items: OwedItem[];
}

/** People who owe you money, largest balance first. */
export async function getBalances(): Promise<MemberBalance[]> {
  const db = await openDatabase();
  const [rows, members] = await Promise.all([
    db.getAllAsync<{
      id: string;
      member_id: string;
      share_paise: number;
      transaction_id: string;
      merchant: string;
      transactionTimestamp: number;
    }>(
      `SELECT s.id, s.member_id, s.share_paise, s.transaction_id, t.merchant, t.transactionTimestamp
       FROM splits s JOIN transactions t ON t.id = s.transaction_id
       WHERE s.settled_at IS NULL AND t.is_dismissed = 0
       ORDER BY t.transactionTimestamp DESC`
    ),
    memberRepository.getAll(),
  ]);
  const byMember = new Map<string, MemberBalance>();
  for (const m of members) byMember.set(m.id, { member: m, owedPaise: 0, items: [] });
  for (const r of rows) {
    const balance = byMember.get(r.member_id);
    if (!balance) continue;
    balance.owedPaise += r.share_paise;
    balance.items.push({
      splitId: r.id,
      transactionId: r.transaction_id,
      merchant: r.merchant,
      timestamp: r.transactionTimestamp,
      sharePaise: r.share_paise,
    });
  }
  return [...byMember.values()].filter((b) => b.owedPaise > 0).sort((a, b) => b.owedPaise - a.owedPaise);
}

export async function getTotalOwed(): Promise<number> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(s.share_paise), 0) AS total FROM splits s
     JOIN transactions t ON t.id = s.transaction_id WHERE s.settled_at IS NULL AND t.is_dismissed = 0`
  );
  return row?.total ?? 0;
}

/** A UPI "pay me" link (opens any UPI app with the amount filled in). */
export function buildUpiLink(input: { upiId: string; name?: string; amountPaise: number; note?: string }): string {
  const params = [
    `pa=${encodeURIComponent(input.upiId.trim())}`,
    input.name ? `pn=${encodeURIComponent(input.name.trim())}` : null,
    `am=${(input.amountPaise / 100).toFixed(2)}`,
    'cu=INR',
    input.note ? `tn=${encodeURIComponent(input.note.slice(0, 50))}` : null,
  ].filter(Boolean);
  return `upi://pay?${params.join('&')}`;
}

const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

export function isValidUpiId(value: string): boolean {
  return UPI_ID.test(value.trim());
}
