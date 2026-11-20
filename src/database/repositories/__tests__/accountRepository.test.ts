import { freshDatabase } from '../../../../test/db';
import { accountRepository, CreateAccountInput } from '../accountRepository';

beforeEach(async () => {
  await freshDatabase();
});

describe('accountRepository', () => {
  it('seeds default cash account on fresh database', async () => {
    const accounts = await accountRepository.getAll();
    expect(accounts.length).toBeGreaterThanOrEqual(1);
    const cash = accounts.find((a) => a.type === 'CASH');
    expect(cash).toBeDefined();
    expect(cash?.name).toBe('Cash');
    expect(cash?.id).toBe('account-cash');
  });

  it('creates and retrieves a new bank account', async () => {
    const input: CreateAccountInput = {
      name: 'ICICI Bank ••172',
      bankName: 'ICICI Bank',
      mask: '172',
      type: 'SAVINGS',
      color: '#007AFF',
      icon: 'building.columns',
    };

    const created = await accountRepository.create(input);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('ICICI Bank ••172');
    expect(created.bankName).toBe('ICICI Bank');
    expect(created.mask).toBe('172');
    expect(created.type).toBe('SAVINGS');

    const fetched = await accountRepository.getById(created.id);
    expect(fetched).toEqual(created);
  });

  it('finds account by bankName and mask', async () => {
    await accountRepository.create({
      name: 'Indian Bank ••1224',
      bankName: 'Indian Bank',
      mask: '1224',
      type: 'SAVINGS',
      color: '#34C759',
    });

    const found = await accountRepository.findByBankAndMask('Indian Bank', '1224');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Indian Bank ••1224');

    const notFound = await accountRepository.findByBankAndMask('Indian Bank', '9999');
    expect(notFound).toBeNull();
  });

  it('updates an account nickname and color', async () => {
    const created = await accountRepository.create({
      name: 'ICICI Bank ••172',
      bankName: 'ICICI Bank',
      mask: '172',
      type: 'SAVINGS',
      color: '#007AFF',
    });

    const updated = await accountRepository.update(created.id, {
      name: 'Salary Account',
      color: '#FF9500',
    });

    expect(updated?.name).toBe('Salary Account');
    expect(updated?.color).toBe('#FF9500');

    const fetched = await accountRepository.getById(created.id);
    expect(fetched?.name).toBe('Salary Account');
  });
});
