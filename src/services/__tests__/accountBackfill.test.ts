import { addTx, freshDatabase } from '../../../test/db';
import { accountRepository } from '@/database/repositories/accountRepository';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import {
  accountBackfillService,
  extractAccountMask,
  extractBankName,
} from '../accountBackfill';
import { getSetting, setSetting } from '../settings';

beforeEach(async () => {
  await freshDatabase();
});

describe('Historical Transaction Account Backfill', () => {
  describe('extractor helpers', () => {
    it('extracts bank name and mask from ICICI Bank messages', () => {
      const msg = 'ICICI Bank Acct XX172 debited for Rs 50.00 on 11-Nov-26; Suresh kumar ho credited.';
      expect(extractBankName(msg)).toBe('ICICI Bank');
      expect(extractAccountMask(msg)).toBe('172');
    });

    it('extracts bank name and mask from Indian Bank messages', () => {
      const msg = 'Sent Rs.70.00 from A/c *1224 on 20-11-26 to Velan Fruit. -Indian Bank';
      expect(extractBankName(msg)).toBe('Indian Bank');
      expect(extractAccountMask(msg)).toBe('1224');
    });

    it('extracts credit card messages', () => {
      const msg = 'Rs 1,499 spent on HDFC Bank Credit Card XX5678 at AMAZON on 12-10-24';
      expect(extractBankName(msg)).toBe('HDFC Bank');
      expect(extractAccountMask(msg)).toBe('5678');
    });
  });

  describe('runAutoBackfill', () => {
    it('silently auto-links confirmed transactions matching an existing account', async () => {
      const account = await accountRepository.create({
        name: 'ICICI Primary',
        bankName: 'ICICI Bank',
        mask: '172',
        type: 'SAVINGS',
        color: '#0A84FF',
        icon: 'landmark',
      });

      const txTimestamp = 1730000000000;
      const tx = await addTx({
        amountPaise: 5000,
        merchant: 'Suresh Kumar',
        at: txTimestamp,
        rawNotification: 'ICICI Bank Acct XX172 debited for Rs 50.00 on 11-Nov-26; Suresh kumar ho credited.',
        status: 'CONFIRMED',
      });

      expect(tx.accountId).toBeNull();

      const res = await accountBackfillService.runAutoBackfill();
      expect(res.linkedCount).toBe(1);
      expect(res.unconfigured).toHaveLength(0);

      const updated = await transactionRepository.getById(tx.id);
      expect(updated?.accountId).toBe(account.id);
      // Verify status and timestamp are untouched
      expect(updated?.status).toBe('CONFIRMED');
      expect(updated?.transactionTimestamp).toBe(txTimestamp);

      // Verify flag is set since no unconfigured accounts remain
      const isDone = await getSetting('hasRunAccountBackfill');
      expect(isDone).toBe(true);
    });

    it('detects and aggregates unconfigured accounts from past transactions', async () => {
      await addTx({
        amountPaise: 7000,
        merchant: 'Velan Fruit',
        at: Date.now() - 10000,
        rawNotification: 'Sent Rs.70.00 from A/c *1224 on 20-11-26 to Velan Fruit. -Indian Bank',
        status: 'CONFIRMED',
      });

      await addTx({
        amountPaise: 3000,
        merchant: 'Rakesh',
        at: Date.now() - 5000,
        rawNotification: 'Your A/c *1224 is credited with Rs.30.00 on 30-09-26 - Indian Bank',
        status: 'CONFIRMED',
      });

      const res = await accountBackfillService.runAutoBackfill();
      expect(res.linkedCount).toBe(0);
      expect(res.unconfigured).toEqual([
        {
          bankName: 'Indian Bank',
          mask: '1224',
          count: 2,
        },
      ]);

      // Should NOT set flag yet because unconfigured accounts exist
      expect(await getSetting('hasRunAccountBackfill')).toBe(false);
    });

    it('completes backfill when unconfigured account is configured', async () => {
      const tx1 = await addTx({
        amountPaise: 7000,
        merchant: 'Velan Fruit',
        at: Date.now() - 10000,
        rawNotification: 'Sent Rs.70.00 from A/c *1224 on 20-11-26 to Velan Fruit. -Indian Bank',
        status: 'CONFIRMED',
      });

      const tx2 = await addTx({
        amountPaise: 3000,
        merchant: 'Rakesh',
        at: Date.now() - 5000,
        rawNotification: 'Your A/c *1224 is credited with Rs.30.00 on 30-09-26 - Indian Bank',
        status: 'CONFIRMED',
      });

      const created = await accountRepository.create({
        name: 'Indian Bank Savings',
        bankName: 'Indian Bank',
        mask: '1224',
        type: 'SAVINGS',
        color: '#30B0C7',
        icon: 'landmark',
      });

      const updatedCount = await accountBackfillService.completeBackfillForAccount(
        'Indian Bank',
        '1224',
        created.id
      );

      expect(updatedCount).toBe(2);

      const r1 = await transactionRepository.getById(tx1.id);
      const r2 = await transactionRepository.getById(tx2.id);
      expect(r1?.accountId).toBe(created.id);
      expect(r2?.accountId).toBe(created.id);

      // Now all are resolved, so backfill flag is marked completed
      expect(await getSetting('hasRunAccountBackfill')).toBe(true);
    });

    it('skips backfill if already marked completed', async () => {
      await setSetting('hasRunAccountBackfill', true);
      const res = await accountBackfillService.runAutoBackfill();
      expect(res.linkedCount).toBe(0);
      expect(res.unconfigured).toHaveLength(0);
    });
  });
});
