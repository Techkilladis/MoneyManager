// Account Repository
import { openDatabase, mapAccountRow } from '../db';
import { Account, AccountType, generateId, now } from '../schema';

export interface CreateAccountInput {
  name: string;
  bankName?: string | null;
  mask?: string | null;
  type: AccountType;
  color?: string | null;
  icon?: string | null;
  isDefault?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  bankName?: string | null;
  mask?: string | null;
  type?: AccountType;
  color?: string | null;
  icon?: string | null;
}

export const accountRepository = {
  async create(input: CreateAccountInput): Promise<Account> {
    const database = await openDatabase();
    const id = generateId();
    const timestamp = now();

    await database.runAsync(
      `INSERT INTO accounts (id, name, bankName, mask, type, color, icon, isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.bankName || null,
        input.mask || null,
        input.type,
        input.color || null,
        input.icon || null,
        input.isDefault ? 1 : 0,
        timestamp,
        timestamp,
      ]
    );

    const row = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [id]);
    return mapAccountRow(row!);
  },

  async getById(id: string): Promise<Account | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [id]);
    return row ? mapAccountRow(row) : null;
  },

  async getAll(): Promise<Account[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync('SELECT * FROM accounts ORDER BY isDefault DESC, createdAt ASC');
    return rows.map(mapAccountRow);
  },

  async findByBankAndMask(bankName: string, mask: string): Promise<Account | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM accounts WHERE LOWER(bankName) = LOWER(?) AND mask = ?',
      [bankName, mask]
    );
    return row ? mapAccountRow(row) : null;
  },

  async update(id: string, input: UpdateAccountInput): Promise<Account | null> {
    const database = await openDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.bankName !== undefined) {
      updates.push('bankName = ?');
      values.push(input.bankName);
    }
    if (input.mask !== undefined) {
      updates.push('mask = ?');
      values.push(input.mask);
    }
    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }
    if (input.icon !== undefined) {
      updates.push('icon = ?');
      values.push(input.icon);
    }

    if (updates.length === 0) return this.getById(id);

    updates.push('updatedAt = ?');
    values.push(now());
    values.push(id);

    await database.runAsync(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const database = await openDatabase();
    const result = await database.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
    return result.changes > 0;
  },

  async count(): Promise<number> {
    const database = await openDatabase();
    const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts');
    return row?.count ?? 0;
  },
};
