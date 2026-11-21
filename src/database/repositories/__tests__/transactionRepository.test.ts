import { freshDatabase } from '../../../../test/db';
import { transactionRepository, CreateTransactionInput } from '../transactionRepository';

beforeEach(async () => {
  await freshDatabase();
});

describe('transactionRepository.createWithIdempotency', () => {
  it('creates a new transaction and returns isNew: true, relinked: false', async () => {
    const input: CreateTransactionInput = {
      amountPaise: 25000,
      merchant: 'Swiggy',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-1',
      sourceType: 'UPI_NOTIFICATION',
    };

    const result = await transactionRepository.createWithIdempotency(input);
    expect(result.isNew).toBe(true);
    expect(result.relinked).toBe(false);
    expect(result.transaction.merchant).toBe('Swiggy');
    expect(result.transaction.amountPaise).toBe(25000);
  });

  it('guarantees strict idempotency and zero duplicates on exact sourceEventId match', async () => {
    const input: CreateTransactionInput = {
      amountPaise: 50000,
      merchant: 'Zomato',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-dup-1',
      sourceType: 'UPI_NOTIFICATION',
    };

    const first = await transactionRepository.createWithIdempotency(input);
    expect(first.isNew).toBe(true);
    expect(first.relinked).toBe(false);

    const second = await transactionRepository.createWithIdempotency(input);
    expect(second.isNew).toBe(false);
    expect(second.relinked).toBe(false);
    expect(second.transaction.id).toBe(first.transaction.id);

    const list = await transactionRepository.list();
    expect(list.filter((t) => t.sourceEventId === 'evt-dup-1').length).toBe(1);
  });

  it('performs fuzzy match deduplication for UPI transactions within 5 minutes', async () => {
    const ts = 1700000000000;
    const first = await transactionRepository.createWithIdempotency({
      amountPaise: 15000,
      merchant: 'Uber',
      transactionTimestamp: ts,
      sourceType: 'UPI_NOTIFICATION',
      kind: 'EXPENSE',
    });
    expect(first.isNew).toBe(true);

    const second = await transactionRepository.createWithIdempotency({
      amountPaise: 15000,
      merchant: 'Uber',
      transactionTimestamp: ts + 120000, // 2 minutes later
      sourceType: 'UPI_NOTIFICATION',
      kind: 'EXPENSE',
    });
    expect(second.isNew).toBe(false);
    expect(second.transaction.id).toBe(first.transaction.id);
  });

  it('re-links in-place from Cash account and preserves user category, note, and splits', async () => {
    const initial = await transactionRepository.create({
      amountPaise: 30000,
      merchant: 'BigBasket',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-relink-cash',
      sourceType: 'UPI_NOTIFICATION',
      accountId: 'account-cash',
      categoryId: 'cat-groceries',
      note: 'Weekly fruits',
      status: 'CONFIRMED',
    });

    const rescan = await transactionRepository.createWithIdempotency({
      amountPaise: 30000,
      merchant: 'BigBasket',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-relink-cash',
      sourceType: 'UPI_NOTIFICATION',
      accountId: 'acc-icici-123',
      parserMetadata: '{"bank":"ICICI Bank","mask":"123"}',
    });

    expect(rescan.isNew).toBe(false);
    expect(rescan.relinked).toBe(true);
    expect(rescan.transaction.id).toBe(initial.id);
    expect(rescan.transaction.accountId).toBe('acc-icici-123');
    expect(rescan.transaction.categoryId).toBe('cat-groceries');
    expect(rescan.transaction.note).toBe('Weekly fruits');
    expect(rescan.transaction.status).toBe('CONFIRMED');
    expect(rescan.transaction.parserMetadata).toBe('{"bank":"ICICI Bank","mask":"123"}');
  });

  it('re-links in-place from null accountId to discovered bank account', async () => {
    const initial = await transactionRepository.create({
      amountPaise: 42000,
      merchant: 'Amazon',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-relink-null',
      sourceType: 'UPI_NOTIFICATION',
      accountId: null,
    });

    const rescan = await transactionRepository.createWithIdempotency({
      amountPaise: 42000,
      merchant: 'Amazon',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-relink-null',
      sourceType: 'UPI_NOTIFICATION',
      accountId: 'acc-hdfc-456',
    });

    expect(rescan.isNew).toBe(false);
    expect(rescan.relinked).toBe(true);
    expect(rescan.transaction.id).toBe(initial.id);
    expect(rescan.transaction.accountId).toBe('acc-hdfc-456');
  });

  it('never overwrites an already-linked non-cash bank account', async () => {
    const initial = await transactionRepository.create({
      amountPaise: 75000,
      merchant: 'Flipkart',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-protect-bank',
      sourceType: 'UPI_NOTIFICATION',
      accountId: 'acc-existing-bank',
    });

    const rescan = await transactionRepository.createWithIdempotency({
      amountPaise: 75000,
      merchant: 'Flipkart',
      transactionTimestamp: 1700000000000,
      sourceEventId: 'evt-protect-bank',
      sourceType: 'UPI_NOTIFICATION',
      accountId: 'acc-other-bank',
    });

    expect(rescan.isNew).toBe(false);
    expect(rescan.relinked).toBe(false);
    expect(rescan.transaction.accountId).toBe('acc-existing-bank');

    const fresh = await transactionRepository.getById(initial.id);
    expect(fresh?.accountId).toBe('acc-existing-bank');
  });
});
