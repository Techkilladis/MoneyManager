import { freshDatabase, addTx } from '../../../../test/db';
import { categoryRepository } from '../categoryRepository';
import { categoryService } from '../../../../src/services';

beforeEach(async () => {
  await freshDatabase();
});

describe('categoryRepository.getRankedByUsage (Category Freshiency)', () => {
  const now = new Date(2026, 10, 23, 12, 0).getTime(); // 23 Nov 2026
  const dayMs = 24 * 60 * 60 * 1000;

  it('returns default catalog sort order (sortOrder ASC, name ASC) for zero transaction history', async () => {
    const categories = await categoryRepository.getRankedByUsage('EXPENSE', { now });
    expect(categories.length).toBeGreaterThan(0);
    // Verify sorted by sortOrder ascending
    for (let i = 0; i < categories.length - 1; i++) {
      if (categories[i].sortOrder === categories[i + 1].sortOrder) {
        expect(categories[i].name.localeCompare(categories[i + 1].name)).toBeLessThanOrEqual(0);
      } else {
        expect(categories[i].sortOrder).toBeLessThanOrEqual(categories[i + 1].sortOrder);
      }
    }
    // cat-food (sortOrder 1) should be first, cat-travel (2) second
    expect(categories[0].id).toBe('cat-food');
    expect(categories[1].id).toBe('cat-travel');
  });

  it('ranks categories by rolling 90-day confirmed transaction count descending', async () => {
    // Health (cat-health, sortOrder 6) gets 5 transactions in last 30 days
    for (let i = 0; i < 5; i++) {
      await addTx({
        categoryId: 'cat-health',
        amountPaise: 50000,
        at: now - 30 * dayMs + i * 1000,
      });
    }

    // Education (cat-education, sortOrder 7) gets 10 transactions in last 10 days
    for (let i = 0; i < 10; i++) {
      await addTx({
        categoryId: 'cat-education',
        amountPaise: 100000,
        at: now - 10 * dayMs + i * 1000,
      });
    }

    // Food (cat-food, sortOrder 1) gets 2 transactions in last 5 days
    for (let i = 0; i < 2; i++) {
      await addTx({
        categoryId: 'cat-food',
        amountPaise: 20000,
        at: now - 5 * dayMs + i * 1000,
      });
    }

    const categories = await categoryRepository.getRankedByUsage('EXPENSE', { now });

    // Education (10 tx) -> Health (5 tx) -> Food (2 tx) -> remaining in catalog order
    expect(categories[0].id).toBe('cat-education');
    expect(categories[1].id).toBe('cat-health');
    expect(categories[2].id).toBe('cat-food');
  });

  it('breaks frequency ties using the most recent confirmed transaction timestamp', async () => {
    // Both Travel (cat-travel) and Shopping (cat-shopping) get exactly 3 transactions in last 90 days
    // Travel last used 10 days ago
    for (let i = 0; i < 3; i++) {
      await addTx({
        categoryId: 'cat-travel',
        amountPaise: 30000,
        at: now - (20 - i * 5) * dayMs, // 20, 15, 10 days ago
      });
    }

    // Shopping last used 2 days ago
    for (let i = 0; i < 3; i++) {
      await addTx({
        categoryId: 'cat-shopping',
        amountPaise: 40000,
        at: now - (12 - i * 5) * dayMs, // 12, 7, 2 days ago
      });
    }

    const categories = await categoryRepository.getRankedByUsage('EXPENSE', { now });

    // Shopping has more recent last transaction (2 days ago vs 10 days ago)
    expect(categories[0].id).toBe('cat-shopping');
    expect(categories[1].id).toBe('cat-travel');
  });

  it('ranks categories used heavily outside the 90-day window above completely unused categories via all-time frequency fallback', async () => {
    // Bills (cat-bills) used 15 times 120 days ago (outside 90-day rolling window)
    for (let i = 0; i < 15; i++) {
      await addTx({
        categoryId: 'cat-bills',
        amountPaise: 150000,
        at: now - (150 - i) * dayMs,
      });
    }

    // Entertainment (cat-entertainment) has zero transactions ever
    const categories = await categoryRepository.getRankedByUsage('EXPENSE', { now });

    // cat-bills should be ranked higher than any completely unused category
    expect(categories[0].id).toBe('cat-bills');
    const billsIndex = categories.findIndex((c) => c.id === 'cat-bills');
    const entertainmentIndex = categories.findIndex((c) => c.id === 'cat-entertainment');
    expect(billsIndex).toBeLessThan(entertainmentIndex);
  });

  it('strictly excludes pending capture, dismissed, unconfirmed, or cancelled transactions', async () => {
    // Health has 5 unconfirmed / pending / dismissed transactions in recent days
    await addTx({
      categoryId: 'cat-health',
      amountPaise: 50000,
      at: now - 5 * dayMs,
      status: 'PENDING',
    });
    await addTx({
      categoryId: 'cat-health',
      amountPaise: 50000,
      at: now - 4 * dayMs,
      is_pending_capture: 1,
    });
    await addTx({
      categoryId: 'cat-health',
      amountPaise: 50000,
      at: now - 3 * dayMs,
      is_dismissed: 1,
    });
    await addTx({
      categoryId: 'cat-health',
      amountPaise: 50000,
      at: now - 2 * dayMs,
      status: 'CANCELLED',
    });

    // Food has 1 confirmed transaction
    await addTx({
      categoryId: 'cat-food',
      amountPaise: 20000,
      at: now - 1 * dayMs,
      status: 'CONFIRMED',
      is_pending_capture: 0,
      is_dismissed: 0,
    });

    const categories = await categoryRepository.getRankedByUsage('EXPENSE', { now });

    // Food should be #1 (1 valid confirmed tx), Health has 0 valid tx so falls back to catalog sortOrder (6)
    expect(categories[0].id).toBe('cat-food');
    const healthIndex = categories.findIndex((c) => c.id === 'cat-health');
    expect(healthIndex).toBeGreaterThan(0);
  });

  it('incorporates newly created custom categories as soon as confirmed transactions are logged under them', async () => {
    const custom = await categoryRepository.create({
      name: 'Pet Care',
      icon: 'paw',
      color: '#A020F0',
      kind: 'EXPENSE',
    });

    // Log 7 confirmed transactions under custom category
    for (let i = 0; i < 7; i++) {
      await addTx({
        categoryId: custom.id,
        amountPaise: 12000,
        at: now - (10 - i) * dayMs,
      });
    }

    const categories = await categoryRepository.getRankedByUsage('EXPENSE', { now });
    expect(categories[0].id).toBe(custom.id);
    expect(categories[0].name).toBe('Pet Care');
  });

  it('exposes getRankedByUsage on categoryService and delegates correctly', async () => {
    await addTx({
      categoryId: 'cat-entertainment',
      amountPaise: 45000,
      at: now - 2 * dayMs,
    });

    const categories = await categoryService.getRankedByUsage('EXPENSE', { now });
    expect(categories[0].id).toBe('cat-entertainment');
  });
});
