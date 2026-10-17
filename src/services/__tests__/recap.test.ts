import { addTx, d, freshDatabase } from '../../../test/db';
import { dismissRecapCard, getMonthlyRecap, getRecapCard, previousMonthKey, recapHeadline, recapShareText } from '../recap';
import { upsertMonthlyBudget } from '../budget';

beforeEach(async () => {
  jest.useFakeTimers({ now: d(2026, 11, 3, 9), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  await freshDatabase();
});
afterEach(() => jest.useRealTimers());

async function octoberData() {
  await addTx({ amountPaise: 9000000, at: d(2026, 10, 1, 10), kind: 'INCOME', merchant: 'Acme' });
  await addTx({ amountPaise: 300000, at: d(2026, 10, 5), merchant: 'Big Bazaar', categoryId: 'cat-shopping' });
  await addTx({ amountPaise: 20000, at: d(2026, 10, 5, 20), merchant: 'Chai Point', categoryId: 'cat-food' });
  await addTx({ amountPaise: 20000, at: d(2026, 10, 9), merchant: 'Chai Point', categoryId: 'cat-food' });
  await addTx({ amountPaise: 400000, at: d(2026, 9, 12), merchant: 'Croma', categoryId: 'cat-shopping' });
}

describe('monthly recap', () => {
  it('summarises a finished month', async () => {
    await octoberData();
    await upsertMonthlyBudget('cat-food', 100000);
    const r = (await getMonthlyRecap('2026-10'))!;

    expect(r.label).toMatch(/October 2026/);
    expect(r.spent).toBe(340000);
    expect(r.count).toBe(3);
    expect(r.previousSpent).toBe(400000);
    expect(r.change).toBeCloseTo(-0.15);
    expect(r.income).toBe(9000000);
    expect(r.saved).toBe(8660000);
    expect(r.categories[0]).toMatchObject({ name: 'Shopping', totalPaise: 300000 });
    expect(r.topMerchant).toEqual({ name: 'Big Bazaar', total: 300000, count: 1 });
    expect(r.biggest?.merchant).toBe('Big Bazaar');
    expect(r.daysCounted).toBe(31);
    expect(r.noSpendDays).toBe(29); // spent on the 5th and 9th only
    expect(r.budgets).toEqual({ total: 1, within: 1 });
    expect(recapHeadline(r)).toBe('You spent 15% less than in September.');
    expect(recapShareText(r)).toContain('No-spend days: 29');
  });

  it('shows the card during the first week for last month until dismissed', async () => {
    await octoberData();
    expect(previousMonthKey()).toBe('2026-10');
    expect((await getRecapCard())?.monthKey).toBe('2026-10');
    await dismissRecapCard('2026-10');
    expect(await getRecapCard()).toBeNull();
  });

  it('has no card after the first week or for an empty month', async () => {
    expect(await getRecapCard()).toBeNull(); // no spending in October
    await octoberData();
    expect(await getRecapCard(d(2026, 11, 12))).toBeNull();
  });

  it('rejects malformed month keys', async () => {
    expect(await getMonthlyRecap('2026-13')).toBeNull();
    expect(await getMonthlyRecap('nope')).toBeNull();
  });
});
