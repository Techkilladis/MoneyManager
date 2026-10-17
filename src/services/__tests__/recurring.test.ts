import { addTx, d, freshDatabase } from '../../../test/db';
import {
  addCadence,
  addRecurring,
  detectCandidates,
  detectFromHistory,
  ignoreCandidate,
  listRecurring,
  monthlyEquivalent,
  nextDueDate,
} from '../recurring';

const DAY = 24 * 60 * 60 * 1000;

describe('dates', () => {
  it('adds months keeping the day, clamped to short months', () => {
    expect(new Date(addCadence(d(2026, 1, 31).getTime(), 'MONTHLY')).getDate()).toBe(28);
    expect(new Date(addCadence(d(2028, 1, 31).getTime(), 'MONTHLY')).getDate()).toBe(29); // leap year
    expect(new Date(addCadence(d(2026, 3, 15).getTime(), 'QUARTERLY')).getMonth()).toBe(5);
    expect(new Date(addCadence(d(2026, 3, 15).getTime(), 'YEARLY')).getFullYear()).toBe(2027);
    expect(addCadence(d(2026, 3, 15).getTime(), 'WEEKLY') - d(2026, 3, 15).getTime()).toBe(7 * DAY);
  });

  it('moves the next due date forward once paid', () => {
    const plan = { anchorDate: d(2026, 10, 5).getTime(), cadence: 'MONTHLY' as const };
    const now = d(2026, 10, 2).getTime();
    expect(nextDueDate(plan, null, now)).toBe(plan.anchorDate);
    expect(new Date(nextDueDate(plan, d(2026, 10, 4).getTime(), now)).getMonth()).toBe(10); // 4 Nov
  });

  it('rolls long-missed payments forward instead of staying overdue', () => {
    const plan = { anchorDate: d(2026, 6, 5).getTime(), cadence: 'MONTHLY' as const };
    const next = nextDueDate(plan, null, d(2026, 10, 17).getTime());
    expect(next).toBeGreaterThanOrEqual(d(2026, 10, 14, 0).getTime());
  });

  it('converts to a monthly cost', () => {
    expect(monthlyEquivalent(120000, 'YEARLY')).toBe(10000);
    expect(monthlyEquivalent(10000, 'MONTHLY')).toBe(10000);
    expect(monthlyEquivalent(10000, 'WEEKLY')).toBe(43333);
    expect(monthlyEquivalent(30000, 'QUARTERLY')).toBe(10000);
  });
});

describe('detection', () => {
  const now = d(2026, 10, 17).getTime();
  const row = (merchant: string, amountPaise: number, at: Date) => ({
    merchant,
    amountPaise,
    transactionTimestamp: at.getTime(),
    categoryId: 'cat-subscriptions',
  });

  it('finds steady monthly payments', () => {
    const found = detectFromHistory(
      [row('Netflix', 64900, d(2026, 7, 16)), row('Netflix', 64900, d(2026, 8, 16)), row('Netflix', 64900, d(2026, 9, 16))],
      now
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: 'Netflix', cadence: 'MONTHLY', amountPaise: 64900, occurrences: 3 });
  });

  it('needs three payments for monthly and allows small amount changes', () => {
    expect(detectFromHistory([row('Jio', 23900, d(2026, 8, 20)), row('Jio', 23900, d(2026, 9, 19))], now)).toEqual([]);
    const found = detectFromHistory(
      [row('Jio', 23900, d(2026, 7, 20)), row('Jio', 25900, d(2026, 8, 20)), row('Jio', 23900, d(2026, 9, 19))],
      now
    );
    expect(found[0]?.cadence).toBe('MONTHLY');
  });

  it('ignores irregular spending and stopped subscriptions', () => {
    const irregular = [row('Swiggy', 35000, d(2026, 9, 1)), row('Swiggy', 12000, d(2026, 9, 3)), row('Swiggy', 50000, d(2026, 9, 20))];
    expect(detectFromHistory(irregular, now)).toEqual([]);
    const stopped = [row('Hotstar', 29900, d(2026, 3, 1)), row('Hotstar', 29900, d(2026, 4, 1)), row('Hotstar', 29900, d(2026, 5, 1))];
    expect(detectFromHistory(stopped, now)).toEqual([]);
  });

  it('spots yearly payments from two occurrences', () => {
    const found = detectFromHistory([row('Domain renewal', 99900, d(2025, 10, 2)), row('Domain renewal', 99900, d(2026, 10, 1))], now);
    expect(found[0]?.cadence).toBe('YEARLY');
  });
});

describe('tracking', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: d(2026, 10, 17, 15), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    await freshDatabase();
  });
  afterEach(() => jest.useRealTimers());

  it('marks a bill paid when a matching payment is recorded', async () => {
    await addRecurring({
      name: 'Rent',
      merchant: 'Rent',
      amountPaise: 2500000,
      cadence: 'MONTHLY',
      categoryId: 'cat-bills',
      anchorDate: d(2026, 10, 20).getTime(),
      remind: true,
    });
    let [rent] = await listRecurring();
    expect(rent.paidThisPeriod).toBe(false);
    expect(rent.daysUntilDue).toBe(3);

    await addTx({ amountPaise: 2500000, at: d(2026, 10, 18), merchant: 'RENT' });
    [rent] = await listRecurring();
    expect(rent.lastPaidAt).toBe(d(2026, 10, 18).getTime());
    expect(new Date(rent.nextDueAt).getMonth()).toBe(10); // November
  });

  it('rejects duplicates and suggests untracked patterns only', async () => {
    for (const m of [7, 8, 9]) await addTx({ amountPaise: 64900, at: d(2026, m, 16), merchant: 'Netflix' });
    expect((await detectCandidates()).map((c) => c.name)).toEqual(['Netflix']);

    const input = { name: 'Netflix', merchant: 'Netflix', amountPaise: 64900, cadence: 'MONTHLY' as const, categoryId: null, anchorDate: Date.now(), remind: true };
    expect((await addRecurring(input)).success).toBe(true);
    expect((await addRecurring(input)).success).toBe(false);
    expect(await detectCandidates()).toEqual([]);
  });

  it('remembers candidates the user dismissed', async () => {
    for (const m of [7, 8, 9]) await addTx({ amountPaise: 9900, at: d(2026, m, 2), merchant: 'Gym' });
    const [gym] = await detectCandidates();
    await ignoreCandidate(gym.merchantKey);
    expect(await detectCandidates()).toEqual([]);
  });
});
