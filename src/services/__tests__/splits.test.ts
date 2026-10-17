import { addTx, d, freshDatabase } from '../../../test/db';
import {
  buildUpiLink,
  equalShares,
  getBalances,
  getSplits,
  getTotalOwed,
  isValidUpiId,
  rescaleSplits,
  setSplits,
  settleMember,
  unsettleSplits,
  validateShares,
} from '../splits';
import { openDatabase } from '../../database/db';

describe('equal shares', () => {
  it('splits with you included and never rounds your share up', () => {
    // ₹100 between you + 2 friends: 33.34 + 33.33 for them, 33.33 left for you.
    expect(equalShares(10000, ['member-friend', 'member-brother'])).toEqual([
      { memberId: 'member-friend', sharePaise: 3334 },
      { memberId: 'member-brother', sharePaise: 3333 },
    ]);
  });

  it('can leave you out entirely', () => {
    const shares = equalShares(10001, ['member-friend', 'member-brother'], false);
    expect(shares.reduce((s, x) => s + x.sharePaise, 0)).toBe(10001);
  });

  it('ignores you if you were picked as a person', () => {
    expect(equalShares(1000, ['member-self'])).toEqual([]);
  });
});

describe('validation', () => {
  it('rejects bad splits', () => {
    expect(validateShares(1000, [{ memberId: 'member-friend', sharePaise: 1001 }])).toMatch(/more than/);
    expect(validateShares(1000, [{ memberId: 'member-friend', sharePaise: 0 }])).toMatch(/more than zero/);
    expect(
      validateShares(1000, [
        { memberId: 'member-friend', sharePaise: 1 },
        { memberId: 'member-friend', sharePaise: 1 },
      ])
    ).toMatch(/once/);
    expect(validateShares(1000, [{ memberId: 'member-friend', sharePaise: 1000 }])).toBeNull();
  });

  it('checks UPI IDs', () => {
    expect(isValidUpiId('ravi.kumar@okicici')).toBe(true);
    expect(isValidUpiId('9876543210@ybl')).toBe(true);
    expect(isValidUpiId('not an id')).toBe(false);
    expect(isValidUpiId('@ybl')).toBe(false);
  });

  it('builds a UPI pay link with the amount filled in', () => {
    expect(buildUpiLink({ upiId: 'me@okaxis', name: 'Asha R', amountPaise: 25050, note: 'Dinner split' })).toBe(
      'upi://pay?pa=me%40okaxis&pn=Asha%20R&am=250.50&cu=INR&tn=Dinner%20split'
    );
  });
});

describe('splits in the database', () => {
  beforeEach(async () => {
    await freshDatabase();
  });

  it('tracks what each person owes and settles it', async () => {
    const dinner = await addTx({ amountPaise: 300000, at: d(2026, 10, 10), merchant: 'Toit' });
    const cab = await addTx({ amountPaise: 60000, at: d(2026, 10, 11), merchant: 'Uber' });
    await setSplits(dinner.id, equalShares(300000, ['member-friend', 'member-brother']));
    await setSplits(cab.id, [{ memberId: 'member-friend', sharePaise: 30000 }]);

    const balances = await getBalances();
    expect(balances.map((b) => [b.member.name, b.owedPaise, b.items.length])).toEqual([
      ['Friend', 130000, 2],
      ['Brother', 100000, 1],
    ]);
    expect(await getTotalOwed()).toBe(230000);

    const settled = await settleMember('member-friend');
    expect(settled).toHaveLength(2);
    expect(await getTotalOwed()).toBe(100000);

    await unsettleSplits(settled);
    expect(await getTotalOwed()).toBe(230000);
  });

  it('keeps transactions.shared_paise in step and keeps settled status on edit', async () => {
    const tx = await addTx({ amountPaise: 100000, at: d(2026, 10, 10) });
    await setSplits(tx.id, [{ memberId: 'member-friend', sharePaise: 50000 }]);
    await settleMember('member-friend');
    await setSplits(tx.id, [
      { memberId: 'member-friend', sharePaise: 40000 },
      { memberId: 'member-mom', sharePaise: 20000 },
    ]);

    const db = await openDatabase();
    const row = await db.getFirstAsync<{ shared_paise: number }>('SELECT shared_paise FROM transactions WHERE id = ?', [tx.id]);
    expect(row?.shared_paise).toBe(60000);
    const splits = await getSplits(tx.id);
    expect(splits.find((s) => s.memberId === 'member-friend')?.settledAt).not.toBeNull();
    expect(splits.find((s) => s.memberId === 'member-mom')?.settledAt).toBeNull();
  });

  it('rescales shares when the amount changes', async () => {
    const tx = await addTx({ amountPaise: 90000, at: d(2026, 10, 10) });
    await setSplits(tx.id, equalShares(90000, ['member-friend', 'member-brother']));
    await openDatabase().then((db) => db.runAsync('UPDATE transactions SET amountPaise = ? WHERE id = ?', [60000, tx.id]));
    await rescaleSplits(tx.id, 90000, 60000);
    const splits = await getSplits(tx.id);
    expect(splits.map((s) => s.sharePaise)).toEqual([20000, 20000]);
  });

  it('refuses to split income', async () => {
    const pay = await addTx({ amountPaise: 100000, at: d(2026, 10, 1), kind: 'INCOME' });
    const result = await setSplits(pay.id, [{ memberId: 'member-friend', sharePaise: 100 }]);
    expect(result.success).toBe(false);
  });

  it('removes splits with the expense', async () => {
    const tx = await addTx({ amountPaise: 1000, at: d(2026, 10, 1) });
    await setSplits(tx.id, [{ memberId: 'member-friend', sharePaise: 500 }]);
    const db = await openDatabase();
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [tx.id]);
    expect(await getTotalOwed()).toBe(0);
  });
});
