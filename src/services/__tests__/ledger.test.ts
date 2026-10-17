import { addTx, d, freshDatabase } from '../../../test/db';
import {
  getCategoryShares,
  getDailyTotals,
  getHistoryTotals,
  getHomeSummary,
  getSpendingSeries,
  savingsRate,
  sumBetween,
} from '../ledger';
import { setSplits } from '../splits';
import { setSetting } from '../settings';

const NOW = d(2026, 10, 17, 15, 0); // Saturday 17 Oct 2026, 3 pm IST

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  await freshDatabase();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('what counts as spending', () => {
  it('ignores pending captures, dismissed captures and income', async () => {
    await addTx({ amountPaise: 10000, at: d(2026, 10, 5) });
    await addTx({ amountPaise: 99900, at: d(2026, 10, 6), status: 'PENDING', is_pending_capture: 1 });
    await addTx({ amountPaise: 55500, at: d(2026, 10, 7), status: 'PENDING', is_pending_capture: 1, is_dismissed: 1 });
    await addTx({ amountPaise: 5000000, at: d(2026, 10, 1), kind: 'INCOME' });

    const month = await sumBetween(d(2026, 10, 1, 0).getTime(), d(2026, 11, 1, 0).getTime());
    expect(month).toEqual({ total: 10000, count: 1 });
  });

  it('counts only your share of a split expense', async () => {
    const tx = await addTx({ amountPaise: 120000, at: d(2026, 10, 10) });
    const result = await setSplits(tx.id, [
      { memberId: 'member-friend', sharePaise: 40000 },
      { memberId: 'member-brother', sharePaise: 40000 },
    ]);
    expect(result.success).toBe(true);

    const month = await sumBetween(d(2026, 10, 1, 0).getTime(), d(2026, 11, 1, 0).getTime());
    expect(month.total).toBe(40000);
  });
});

describe('home summary', () => {
  it('totals today, this week (Monday start) and this month', async () => {
    await addTx({ amountPaise: 1000, at: d(2026, 10, 17, 9) }); // today
    await addTx({ amountPaise: 2000, at: d(2026, 10, 12, 9) }); // Monday this week
    await addTx({ amountPaise: 4000, at: d(2026, 10, 11, 23, 30) }); // Sunday last week
    await addTx({ amountPaise: 8000, at: d(2026, 10, 1, 0, 5) }); // first minutes of the month
    await addTx({ amountPaise: 16000, at: d(2026, 9, 30, 23, 55) }); // last month

    const s = await getHomeSummary();
    expect(s.todayTotal).toBe(1000);
    expect(s.weekTotal).toBe(3000);
    expect(s.monthTotal).toBe(15000);
    expect(s.monthCount).toBe(4);
    expect(s.dailyAverage).toBe(Math.round(15000 / 17));
  });

  it('compares with the same days of last month, not the whole month', async () => {
    await addTx({ amountPaise: 30000, at: d(2026, 10, 3) });
    await addTx({ amountPaise: 10000, at: d(2026, 9, 5) }); // inside the first 17 days of September
    await addTx({ amountPaise: 90000, at: d(2026, 9, 25) }); // later in September

    const s = await getHomeSummary();
    expect(s.lastMonthToDate).toBe(10000);
    expect(s.lastMonthTotal).toBe(100000);
  });

  it('shows income, money left and savings rate', async () => {
    await addTx({ amountPaise: 5000000, at: d(2026, 10, 1, 10), kind: 'INCOME' });
    await addTx({ amountPaise: 1250000, at: d(2026, 10, 9) });

    const s = await getHomeSummary();
    expect(s.monthIncome).toBe(5000000);
    expect(s.monthLeft).toBe(3750000);
    expect(s.savingsRate).toBeCloseTo(0.75);
    // Income shows in the recent list but not in spending totals.
    expect(s.recent.map((t) => t.kind)).toContain('INCOME');
    expect(s.monthTotal).toBe(1250000);
  });

  it('prefers the overall monthly budget when one is set', async () => {
    await addTx({ amountPaise: 700000, at: d(2026, 10, 9) });
    await setSetting('overallBudgetPaise', 2000000);
    const s = await getHomeSummary();
    expect(s.budget).toEqual({ limit: 2000000, spent: 700000, count: 0, overall: true });
  });

  it('reports pending captures separately', async () => {
    await addTx({ amountPaise: 15000, at: d(2026, 10, 17, 14), status: 'PENDING', is_pending_capture: 1 });
    const s = await getHomeSummary();
    expect(s.pending).toHaveLength(1);
    expect(s.pendingTotal).toBe(15000);
    expect(s.monthTotal).toBe(0);
    expect(s.hasAnyTransactions).toBe(true);
  });
});

describe('history', () => {
  it('splits totals into spending and income and filters by kind', async () => {
    await addTx({ amountPaise: 20000, at: d(2026, 10, 2) });
    await addTx({ amountPaise: 30000, at: d(2026, 10, 3) });
    await addTx({ amountPaise: 100000, at: d(2026, 10, 4), kind: 'INCOME' });

    expect(await getHistoryTotals({})).toEqual({ total: 50000, income: 100000, count: 3 });
    expect(await getHistoryTotals({ kind: 'INCOME' })).toEqual({ total: 0, income: 100000, count: 1 });
    expect(await getHistoryTotals({ kind: 'EXPENSE' })).toEqual({ total: 50000, income: 0, count: 2 });
  });

  it('buckets days in local time (IST), not UTC', async () => {
    // 00:30 IST on 5 Oct is still 4 Oct in UTC.
    await addTx({ amountPaise: 4500, at: d(2026, 10, 5, 0, 30) });
    const days = await getDailyTotals({});
    expect(days.get(d(2026, 10, 5, 0, 0).getTime())).toEqual({ spent: 4500, income: 0 });
    expect(days.has(d(2026, 10, 4, 0, 0).getTime())).toBe(false);
  });

  it('searches merchant and note', async () => {
    await addTx({ amountPaise: 100, at: d(2026, 10, 2), merchant: 'Chai Point' });
    await addTx({ amountPaise: 200, at: d(2026, 10, 2), merchant: 'Uber', note: 'chai run' });
    await addTx({ amountPaise: 300, at: d(2026, 10, 2), merchant: 'Amazon' });
    expect((await getHistoryTotals({ search: 'chai' })).count).toBe(2);
  });
});

describe('series and breakdowns', () => {
  it('fills days without spending with zero', async () => {
    await addTx({ amountPaise: 1000, at: d(2026, 10, 1) });
    await addTx({ amountPaise: 3000, at: d(2026, 10, 3) });
    const series = await getSpendingSeries(d(2026, 10, 1, 0).getTime(), d(2026, 10, 4, 0).getTime(), 'day');
    expect(series.map((p) => p.totalPaise)).toEqual([1000, 0, 3000]);
  });

  it('ranks categories by your share and computes shares of the total', async () => {
    await addTx({ amountPaise: 30000, at: d(2026, 10, 2), categoryId: 'cat-food' });
    await addTx({ amountPaise: 10000, at: d(2026, 10, 2), categoryId: 'cat-travel' });
    const shares = await getCategoryShares(d(2026, 10, 1, 0).getTime(), d(2026, 11, 1, 0).getTime());
    expect(shares.map((s) => [s.name, s.totalPaise, s.share])).toEqual([
      ['Food', 30000, 0.75],
      ['Travel', 10000, 0.25],
    ]);
  });

  it('computes savings rate', () => {
    expect(savingsRate(0, 100)).toBeNull();
    expect(savingsRate(1000, 250)).toBe(0.75);
    expect(savingsRate(1000, 1500)).toBe(-0.5);
  });
});
