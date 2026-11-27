import { addTx, freshDatabase } from '../../../test/db';
import { accountRepository } from '@/database/repositories/accountRepository';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import {
  accountBackfillService,
  extractAccountMask,
  extractBankName,
} from '../accountBackfill';
import { notificationDetectionService } from '../notificationDetection';
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

    it('bypasses completed flag when force: true is specified', async () => {
      await setSetting('hasRunAccountBackfill', true);

      await accountRepository.create({
        name: 'ICICI Primary',
        bankName: 'ICICI Bank',
        mask: '172',
        type: 'SAVINGS',
      });

      await addTx({
        amountPaise: 5000,
        merchant: 'Suresh Kumar',
        at: 1730000000000,
        rawNotification: 'ICICI Bank Acct XX172 debited for Rs 50.00 on 11-Nov-26; Suresh kumar ho credited.',
        status: 'CONFIRMED',
      });

      // Normal call is gated
      const normalRes = await accountBackfillService.runAutoBackfill();
      expect(normalRes.linkedCount).toBe(0);

      // Force call runs backfill
      const forceRes = await accountBackfillService.runAutoBackfill({ force: true });
      expect(forceRes.linkedCount).toBe(1);
    });

    it('re-links transactions previously assigned to account-cash to matching bank account', async () => {
      const account = await accountRepository.create({
        name: 'ICICI Primary',
        bankName: 'ICICI Bank',
        mask: '172',
        type: 'SAVINGS',
      });

      const txTimestamp = 1730000000000;
      const tx = await addTx({
        amountPaise: 5000,
        merchant: 'Suresh Kumar',
        at: txTimestamp,
        rawNotification: 'ICICI Bank Acct XX172 debited for Rs 50.00 on 11-Nov-26; Suresh kumar ho credited.',
        status: 'CONFIRMED',
        accountId: 'account-cash',
        note: 'Keep my note intact',
      });

      expect(tx.accountId).toBe('account-cash');

      const res = await accountBackfillService.runAutoBackfill({ force: true });
      expect(res.linkedCount).toBe(1);

      const updated = await transactionRepository.getById(tx.id);
      expect(updated?.accountId).toBe(account.id);
      expect(updated?.status).toBe('CONFIRMED');
      expect(updated?.transactionTimestamp).toBe(txTimestamp);
      expect(updated?.note).toBe('Keep my note intact');
    });

    it('completeBackfillForAccount updates cash transactions and pending captures', async () => {
      const tx = await addTx({
        amountPaise: 7000,
        merchant: 'Velan Fruit',
        at: Date.now() - 10000,
        rawNotification: 'Sent Rs.70.00 from A/c *1224 on 20-11-26 to Velan Fruit. -Indian Bank',
        status: 'CONFIRMED',
        accountId: 'account-cash',
      });

      // Pending capture with matching mask
      const pendingTx = await addTx({
        amountPaise: 2000,
        merchant: 'Chai Point',
        at: Date.now() - 5000,
        status: 'PENDING',
        is_pending_capture: 1,
        parserMetadata: JSON.stringify({
          pendingAccount: { bankName: 'Indian Bank', mask: '1224', resolved: false },
        }),
      });

      const account = await accountRepository.create({
        name: 'Indian Bank Savings',
        bankName: 'Indian Bank',
        mask: '1224',
        type: 'SAVINGS',
      });

      const updatedCount = await accountBackfillService.completeBackfillForAccount(
        'Indian Bank',
        '1224',
        account.id
      );

      expect(updatedCount).toBe(1);

      const updatedTx = await transactionRepository.getById(tx.id);
      expect(updatedTx?.accountId).toBe(account.id);

      const updatedPending = await transactionRepository.getById(pendingTx.id);
      expect(updatedPending?.accountId).toBe(account.id);
    });

    it('completeBackfillForAccount matches transactions even when user enters a bankName variant (e.g. HDFC Credit Card vs HDFC Bank)', async () => {
      const tx = await addTx({
        amountPaise: 149900,
        merchant: 'Amazon',
        at: Date.now() - 10000,
        status: 'CONFIRMED',
        accountId: 'account-cash',
        parserMetadata: JSON.stringify({
          pendingAccount: { bankName: 'HDFC Bank', mask: '5678' },
        }),
      });

      const card = await accountRepository.create({
        name: 'HDFC Millennia',
        bankName: 'HDFC Credit Card',
        mask: '5678',
        type: 'CREDIT_CARD',
      });

      const updatedCount = await accountBackfillService.completeBackfillForAccount(
        'HDFC Credit Card',
        '5678',
        card.id
      );

      expect(updatedCount).toBe(1);
      const updated = await transactionRepository.getById(tx.id);
      expect(updated?.accountId).toBe(card.id);
    });

    it('recovers account metadata from already-consumed native events during rerun backfill', async () => {
      const card = await accountRepository.create({
        name: 'HDFC Card',
        bankName: 'HDFC Bank',
        mask: '4321',
        type: 'CREDIT_CARD',
      });

      const tx = await addTx({
        amountPaise: 50000,
        merchant: 'Swiggy',
        at: 1730000000000,
        sourceEventId: 'native-consumed-1',
        sourceType: 'UPI_NOTIFICATION',
        status: 'CONFIRMED',
        accountId: 'account-cash',
      });

      const spy = jest.spyOn(notificationDetectionService, 'getAllPendingUpiEvents').mockResolvedValue([
        {
          id: 'native-consumed-1',
          amountPaise: 50000,
          merchant: 'Swiggy',
          sourceApp: 'BANK_SMS',
          transactionTimestamp: 1730000000000,
          parserName: 'BankSmsParser',
          confidence: 0.8,
          notificationId: 'notif-1',
          status: 'CONSUMED',
          createdAt: 1730000000000,
          dedupeKey: 'dedupe-1',
          direction: 'DEBIT',
          accountMask: '4321',
          bankName: 'HDFC Bank',
        },
      ]);

      try {
        const res = await accountBackfillService.runAutoBackfill({ force: true });
        expect(res.linkedCount).toBe(1);
        const updated = await transactionRepository.getById(tx.id);
        expect(updated?.accountId).toBe(card.id);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
