import * as Notifications from 'expo-notifications';
import { addTx, d, freshDatabase } from '../../../test/db';
import { getMonthlyBudgets, upsertMonthlyBudget, calculateBudgetStatus } from '../budget';
import { checkBudgetAlerts } from '../alerts';
import { setSetting } from '../settings';

const NOW = d(2026, 10, 17, 15);

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  await freshDatabase();
  jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
});

afterEach(() => jest.useRealTimers());

describe('monthly budgets', () => {
  it('apply to every month, not just the month they were created in', async () => {
    await upsertMonthlyBudget('cat-food', 500000);
    await addTx({ amountPaise: 120000, at: d(2026, 10, 3), categoryId: 'cat-food' });
    await addTx({ amountPaise: 80000, at: d(2026, 11, 3), categoryId: 'cat-food' });

    const october = await getMonthlyBudgets(d(2026, 10, 20));
    const november = await getMonthlyBudgets(d(2026, 11, 20));
    expect(october[0].spentPaise).toBe(120000);
    expect(november[0].spentPaise).toBe(80000);
  });

  it('adds up every matching expense (no 50-row cap)', async () => {
    await upsertMonthlyBudget('cat-food', 1000000);
    for (let i = 0; i < 60; i++) {
      await addTx({ amountPaise: 1000, at: d(2026, 10, 1 + (i % 16), 10), categoryId: 'cat-food' });
    }
    const [food] = await getMonthlyBudgets(NOW);
    expect(food.spentPaise).toBe(60000);
  });

  it('upserts instead of creating duplicates and validates amounts', async () => {
    await upsertMonthlyBudget('cat-food', 100000);
    await upsertMonthlyBudget('cat-food', 250000);
    const budgets = await getMonthlyBudgets(NOW);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].budget.amountPaise).toBe(250000);
    expect((await upsertMonthlyBudget('cat-food', 0)).success).toBe(false);
    expect((await upsertMonthlyBudget('cat-missing', 1000)).success).toBe(false);
  });

  it('computes remaining, percentage and status', async () => {
    await upsertMonthlyBudget('cat-travel', 100000);
    await addTx({ amountPaise: 80000, at: d(2026, 10, 5), categoryId: 'cat-travel' });
    const [travel] = await getMonthlyBudgets(NOW);
    expect(travel.remainingPaise).toBe(20000);
    expect(travel.percentageUsed).toBe(80);
    expect(travel.status).toBe('WARNING');
    expect(calculateBudgetStatus(50)).toBe('HEALTHY');
    expect(calculateBudgetStatus(100)).toBe('EXCEEDED');
  });
});

describe('budget alerts', () => {
  it('fires at 80% and at 100%, once each per month', async () => {
    await upsertMonthlyBudget('cat-food', 100000);

    await addTx({ amountPaise: 50000, at: d(2026, 10, 2), categoryId: 'cat-food' });
    expect(await checkBudgetAlerts()).toEqual([]);

    await addTx({ amountPaise: 35000, at: d(2026, 10, 3), categoryId: 'cat-food' });
    const first = await checkBudgetAlerts();
    expect(first.map((a) => a.threshold)).toEqual([80]);
    expect(await checkBudgetAlerts()).toEqual([]); // not again

    await addTx({ amountPaise: 20000, at: d(2026, 10, 4), categoryId: 'cat-food' });
    const second = await checkBudgetAlerts();
    expect(second.map((a) => a.threshold)).toEqual([100]);
    expect(second[0].categoryName).toBe('Food');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('includes the overall monthly budget', async () => {
    await setSetting('overallBudgetPaise', 1000000);
    await addTx({ amountPaise: 950000, at: d(2026, 10, 2), categoryId: 'cat-shopping' });
    const fired = await checkBudgetAlerts();
    expect(fired).toEqual([expect.objectContaining({ budgetId: 'overall', threshold: 80 })]);
  });

  it('stays quiet when alerts are turned off', async () => {
    await setSetting('budgetAlertsEnabled', false);
    await upsertMonthlyBudget('cat-food', 1000);
    await addTx({ amountPaise: 5000, at: d(2026, 10, 2), categoryId: 'cat-food' });
    expect(await checkBudgetAlerts()).toEqual([]);
  });
});
