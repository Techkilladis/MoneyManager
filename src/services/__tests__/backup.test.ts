import { addTx, d, freshDatabase } from '../../../test/db';
import { createBackup, parseBackup, restoreBackup, summarize } from '../backup';
import { getHistoryTotals } from '../ledger';
import { upsertMonthlyBudget, getMonthlyBudgets } from '../budget';
import { setSplits, getTotalOwed } from '../splits';
import { getSetting, setSetting } from '../settings';
import { transactionService } from '../index';
import { openDatabase } from '../../database/db';

beforeEach(async () => {
  await freshDatabase();
});

describe('backup and restore', () => {
  it('round-trips transactions, splits, budgets and settings', async () => {
    const dinner = await addTx({ amountPaise: 240000, at: d(2026, 10, 3), merchant: 'Toit', categoryId: 'cat-food' });
    await addTx({ amountPaise: 9000000, at: d(2026, 10, 1), kind: 'INCOME', merchant: 'Acme' });
    await setSplits(dinner.id, [{ memberId: 'member-friend', sharePaise: 120000 }]);
    await upsertMonthlyBudget('cat-food', 800000);
    await setSetting('upiId', 'me@okaxis');
    await setSetting('appLockEnabled', true);

    // Through JSON, like a real file.
    const file = parseBackup(JSON.stringify(await createBackup()));
    expect(summarize(file)).toMatchObject({ transactions: 2, budgets: 1 });

    // Wipe everything and start over, as on a new phone.
    await freshDatabase();
    expect((await getHistoryTotals({})).count).toBe(0);

    await restoreBackup(file);
    expect(await getHistoryTotals({})).toEqual({ total: 120000, income: 9000000, count: 2 });
    expect(await getTotalOwed()).toBe(120000);
    expect((await getMonthlyBudgets(d(2026, 10, 15)))[0].budget.amountPaise).toBe(800000);
    expect(await getSetting('upiId')).toBe('me@okaxis');
    // Device-only settings don't travel.
    expect(await getSetting('appLockEnabled')).toBe(false);
  });

  it('replaces existing data rather than merging', async () => {
    await addTx({ amountPaise: 100, at: d(2026, 10, 3) });
    const file = await createBackup();
    await addTx({ amountPaise: 200, at: d(2026, 10, 4) });
    await restoreBackup(file);
    expect((await getHistoryTotals({})).count).toBe(1);
  });

  it('ignores columns this version does not know', async () => {
    await addTx({ amountPaise: 100, at: d(2026, 10, 3) });
    const file = await createBackup();
    file.tables.transactions = file.tables.transactions!.map((r) => ({ ...r, someFutureColumn: 'x' }));
    await restoreBackup(file);
    expect((await getHistoryTotals({})).count).toBe(1);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/isn't a Money Manager backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(/isn't a Money Manager backup/);
    expect(() =>
      parseBackup(JSON.stringify({ app: 'money-manager', format: 1, schemaVersion: 999, exportedAt: 0, tables: {} }))
    ).toThrow(/newer version/);
    expect(() =>
      parseBackup(JSON.stringify({ app: 'money-manager', format: 1, schemaVersion: 6, exportedAt: 0, tables: { evil: [] } }))
    ).toThrow(/damaged/);
  });
});

describe('undo delete', () => {
  it('puts a deleted expense back with its splits', async () => {
    const tx = await addTx({ amountPaise: 50000, at: d(2026, 10, 3) });
    await setSplits(tx.id, [{ memberId: 'member-friend', sharePaise: 25000 }]);

    const result = await transactionService.deleteWithUndo(tx.id);
    expect(result.success).toBe(true);
    expect((await getHistoryTotals({})).count).toBe(0);
    expect(await getTotalOwed()).toBe(0);

    await transactionService.restoreTransaction(result.snapshot!);
    expect(await getHistoryTotals({})).toEqual({ total: 25000, income: 0, count: 1 });
    expect(await getTotalOwed()).toBe(25000);
  });

  it('refuses to delete a pending capture (it must be dismissed)', async () => {
    const tx = await addTx({ amountPaise: 100, at: d(2026, 10, 3), status: 'PENDING', is_pending_capture: 1 });
    expect((await transactionService.deleteWithUndo(tx.id)).success).toBe(false);
    const db = await openDatabase();
    expect(await db.getFirstAsync('SELECT id FROM transactions WHERE id = ?', [tx.id])).not.toBeNull();
  });
});
