// Helpers for tests that need a real (in-memory) database.
import { closeDatabase, initializeDatabase } from '@/database/db';
import { transactionRepository, CreateTransactionInput } from '@/database/repositories/transactionRepository';
import { resetSettingsCache } from '@/services/settings';

/** A brand-new database with the real schema, migrations and default categories/members. */
export async function freshDatabase(): Promise<void> {
  await closeDatabase();
  resetSettingsCache();
  await initializeDatabase();
}

/** Inserts a confirmed expense (or income) at a given time. */
export async function addTx(input: Partial<CreateTransactionInput> & { amountPaise: number; at: Date | number }) {
  const { at, ...rest } = input;
  return transactionRepository.create({
    merchant: 'Shop',
    status: 'CONFIRMED',
    sourceType: 'MANUAL',
    is_pending_capture: 0,
    is_dismissed: 0,
    ...rest,
    transactionTimestamp: typeof at === 'number' ? at : at.getTime(),
  });
}

/** Local date helper: d(2026, 10, 5, 14) = 5 Oct 2026 14:00 local. */
export function d(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}
