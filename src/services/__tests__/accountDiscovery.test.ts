import { freshDatabase } from '../../../test/db';
import { accountRepository } from '@/database/repositories/accountRepository';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import { captureInput, transactionService } from '../index';
import { PendingUpiEvent } from '../notificationDetection';

beforeEach(async () => {
  await freshDatabase();
});

describe('In-Flight Account Discovery & Assignment', () => {
  const sampleEvent: PendingUpiEvent = {
    id: 'evt-1',
    amountPaise: 5000,
    merchant: 'Swiggy',
    sourceApp: 'SMS',
    transactionTimestamp: Date.now(),
    notificationId: 'notif-1',
    parserName: 'SmsUpiParser',
    confidence: 1.0,
    status: 'PENDING',
    createdAt: Date.now(),
    dedupeKey: 'dedupe-1',
    direction: 'DEBIT',
    accountMask: '172',
    bankName: 'ICICI Bank',
  };

  it('flags transaction with pendingAccount when account is unconfigured', async () => {
    const input = await captureInput(sampleEvent);
    expect(input.accountId).toBeNull();
    const meta = JSON.parse(input.parserMetadata!);
    expect(meta.pendingAccount).toEqual({
      bankName: 'ICICI Bank',
      mask: '172',
    });

    const tx = await transactionRepository.create(input);
    const formatted = await transactionService.getFormattedTransaction(tx.id);
    expect(formatted?.account).toBeNull();
    expect(formatted?.pendingAccount).toEqual({
      bankName: 'ICICI Bank',
      mask: '172',
    });
  });

  it('auto-assigns accountId when bankName and mask match an existing account', async () => {
    const existing = await accountRepository.create({
      name: 'ICICI Salary',
      bankName: 'ICICI Bank',
      mask: '172',
      type: 'SAVINGS',
      color: '#0A84FF',
      icon: 'landmark',
    });

    const input = await captureInput(sampleEvent);
    expect(input.accountId).toBe(existing.id);

    const tx = await transactionRepository.create(input);
    const formatted = await transactionService.getFormattedTransaction(tx.id);
    expect(formatted?.account?.id).toBe(existing.id);
    expect(formatted?.account?.name).toBe('ICICI Salary');
    expect(formatted?.pendingAccount).toBeNull();
  });

  it('batch links all pending transactions matching newly created account', async () => {
    // 1. Ingest two transactions with unconfigured ICICI XX172
    const input1 = await captureInput({ ...sampleEvent, id: 'evt-1' });
    const input2 = await captureInput({ ...sampleEvent, id: 'evt-2', merchant: 'Zomato' });
    const tx1 = await transactionRepository.create(input1);
    const tx2 = await transactionRepository.create(input2);

    expect(tx1.accountId).toBeNull();
    expect(tx2.accountId).toBeNull();

    // 2. User discovers and creates the account
    const newAccount = await accountRepository.create({
      name: 'ICICI Savings',
      bankName: 'ICICI Bank',
      mask: '172',
      type: 'SAVINGS',
      color: '#0A84FF',
      icon: 'landmark',
    });

    // 3. Batch assign to pending
    const updatedCount = await transactionService.assignAccountToPending('ICICI Bank', '172', newAccount.id);
    expect(updatedCount).toBe(2);

    // 4. Verify both transactions now link to the new account
    const formatted1 = await transactionService.getFormattedTransaction(tx1.id);
    const formatted2 = await transactionService.getFormattedTransaction(tx2.id);

    expect(formatted1?.account?.id).toBe(newAccount.id);
    expect(formatted1?.account?.name).toBe('ICICI Savings');
    expect(formatted1?.pendingAccount).toBeNull();

    expect(formatted2?.account?.id).toBe(newAccount.id);
    expect(formatted2?.account?.name).toBe('ICICI Savings');
    expect(formatted2?.pendingAccount).toBeNull();
  });

  it('confirming transaction persists the assigned accountId', async () => {
    const account = await accountRepository.create({
      name: 'Indian Bank',
      bankName: 'Indian Bank',
      mask: '1224',
      type: 'SAVINGS',
      color: '#30B0C7',
      icon: 'landmark',
    });

    const input = await captureInput({
      ...sampleEvent,
      id: 'evt-ib',
      bankName: 'Indian Bank',
      accountMask: '1224',
    });
    const tx = await transactionRepository.create(input);

    const result = await transactionService.confirmTransaction(
      tx.id,
      undefined,
      undefined,
      tx.amountPaise,
      tx.merchant,
      'Confirmed with account',
      account.id
    );

    expect(result.success).toBe(true);
    expect(result.transaction?.accountId).toBe(account.id);

    const confirmed = await transactionService.getFormattedTransaction(tx.id);
    expect(confirmed?.status).toBe('CONFIRMED');
    expect(confirmed?.account?.id).toBe(account.id);
  });
});
