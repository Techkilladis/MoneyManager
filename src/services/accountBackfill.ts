import { openDatabase } from '@/database/db';
import { accountRepository } from '@/database/repositories/accountRepository';
import { getSetting, setSetting } from './settings';
import { dataEvents } from './events';

const ACCOUNT_MASK_REGEX = /\b(?:Acct|Account|A\/c|Card)\s*(?:ending)?\s*[:#\-]?\s*[*xX]*([0-9]{3,6})\b/i;

export function extractBankName(text: string, sender?: string | null): string | null {
  const s = (sender ?? '').toUpperCase();
  const t = text.toUpperCase();
  if (t.includes('ICICI BANK') || s.includes('ICICI')) return 'ICICI Bank';
  if (t.includes('INDIAN BANK') || s.includes('INDBNK') || s.includes('INDIANB')) return 'Indian Bank';
  if (t.includes('HDFC BANK') || s.includes('HDFC')) return 'HDFC Bank';
  if (t.includes('STATE BANK OF INDIA') || t.includes('SBI') || s.includes('SBI')) return 'SBI';
  if (t.includes('AXIS BANK') || s.includes('AXIS')) return 'Axis Bank';
  if (t.includes('KOTAK') || s.includes('KOTAK')) return 'Kotak Bank';
  if (t.includes('BANK OF BARODA') || s.includes('BARODA') || s.includes('BOB')) return 'Bank of Baroda';
  if (t.includes('CANARA BANK') || s.includes('CANARA') || s.includes('CANBNK')) return 'Canara Bank';
  if (t.includes('PUNJAB NATIONAL BANK') || s.includes('PNB')) return 'PNB';
  if (t.includes('UNION BANK') || s.includes('UNIONB') || s.includes('UBI')) return 'Union Bank';
  if (t.includes('IDFC') || s.includes('IDFC')) return 'IDFC First Bank';
  if (t.includes('FEDERAL BANK') || s.includes('FEDBNK')) return 'Federal Bank';
  if (t.includes('YES BANK') || s.includes('YESB')) return 'Yes Bank';
  if (t.includes('INDUSIND') || s.includes('INDUS')) return 'IndusInd Bank';
  return null;
}

export function extractAccountMask(text: string): string | null {
  const m = text.match(ACCOUNT_MASK_REGEX);
  return m ? m[1] : null;
}

export interface DiscoveredAccount {
  bankName?: string;
  mask: string;
  count: number;
}

export interface BackfillOptions {
  force?: boolean; // When true, runs backfill even if hasRunAccountBackfill is true
}

export const accountBackfillService = {
  /** Check if the historical account backfill has already completed. */
  async isBackfillCompleted(): Promise<boolean> {
    return getSetting('hasRunAccountBackfill');
  },

  /**
   * Scans confirmed transactions with rawNotification text or parser metadata.
   * Auto-links transactions to matching existing accounts without modifying status or timestamps.
   * Collects unique unconfigured accounts that need user configuration.
   */
  async runAutoBackfill(options?: BackfillOptions): Promise<{ linkedCount: number; unconfigured: DiscoveredAccount[] }> {
    const isDone = await this.isBackfillCompleted();
    if (isDone && !options?.force) {
      return { linkedCount: 0, unconfigured: [] };
    }

    const db = await openDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      rawNotification: string | null;
      parserMetadata: string | null;
      sourceApp: string | null;
    }>(
      `SELECT id, rawNotification, parserMetadata, sourceApp FROM transactions 
       WHERE status = 'CONFIRMED' AND (accountId IS NULL OR accountId = '' OR accountId = 'account-cash')`
    );

    const accounts = await accountRepository.getAll();
    let linkedCount = 0;
    const unconfiguredMap = new Map<string, DiscoveredAccount>();

    for (const row of rows) {
      let mask: string | null = null;
      let bankName: string | null = null;

      // Check parser metadata first
      if (row.parserMetadata) {
        try {
          const meta = JSON.parse(row.parserMetadata);
          if (meta?.pendingAccount?.mask) {
            mask = meta.pendingAccount.mask;
            bankName = meta.pendingAccount.bankName ?? null;
          }
        } catch {
          // ignore
        }
      }

      // If not in metadata, extract from rawNotification
      if (!mask && row.rawNotification) {
        mask = extractAccountMask(row.rawNotification);
        bankName = extractBankName(row.rawNotification, row.sourceApp);
      }

      if (!mask) continue;

      // Check if matches an existing account
      const normBank = bankName?.toLowerCase();
      const matched = accounts.find(
        (a) => a.mask === mask && (!normBank || !a.bankName || a.bankName.toLowerCase() === normBank)
      );

      if (matched) {
        await db.runAsync('UPDATE transactions SET accountId = ? WHERE id = ?', [matched.id, row.id]);
        linkedCount++;
      } else {
        const key = `${bankName ?? ''}:${mask}`;
        const existing = unconfiguredMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          unconfiguredMap.set(key, {
            bankName: bankName || undefined,
            mask,
            count: 1,
          });
        }
      }
    }

    const unconfigured = Array.from(unconfiguredMap.values());
    if (unconfigured.length === 0) {
      await setSetting('hasRunAccountBackfill', true);
    }

    if (linkedCount > 0) {
      dataEvents.emit();
    }

    return { linkedCount, unconfigured };
  },

  /**
   * Once an account is created, completes backfill for all matching confirmed transactions.
   */
  async completeBackfillForAccount(
    bankName: string | undefined,
    mask: string,
    accountId: string
  ): Promise<number> {
    const db = await openDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      rawNotification: string | null;
      parserMetadata: string | null;
      sourceApp: string | null;
    }>(
      `SELECT id, rawNotification, parserMetadata, sourceApp FROM transactions 
       WHERE status = 'CONFIRMED' AND (accountId IS NULL OR accountId = '' OR accountId = 'account-cash')`
    );

    let updatedCount = 0;
    const normBank = bankName?.toLowerCase();

    for (const row of rows) {
      let rowMask: string | null = null;
      let rowBank: string | null = null;

      if (row.parserMetadata) {
        try {
          const meta = JSON.parse(row.parserMetadata);
          if (meta?.pendingAccount?.mask) {
            rowMask = meta.pendingAccount.mask;
            rowBank = meta.pendingAccount.bankName ?? null;
          }
        } catch {
          // ignore
        }
      }

      if (!rowMask && row.rawNotification) {
        rowMask = extractAccountMask(row.rawNotification);
        rowBank = extractBankName(row.rawNotification, row.sourceApp);
      }

      if (rowMask === mask) {
        const rowNormBank = rowBank?.toLowerCase();
        if (!normBank || !rowNormBank || rowNormBank === normBank) {
          await db.runAsync('UPDATE transactions SET accountId = ? WHERE id = ?', [accountId, row.id]);
          updatedCount++;
        }
      }
    }

    // Synchronously update pending captures
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transactionService } = require('./index');
    await transactionService.assignAccountToPending(bankName, mask, accountId);

    // Re-check if any unconfigured remain
    const remaining = await this.runAutoBackfill({ force: true });
    if (remaining.unconfigured.length === 0) {
      await setSetting('hasRunAccountBackfill', true);
    }

    if (updatedCount > 0) {
      dataEvents.emit();
    }

    return updatedCount;
  },

  /** Mark backfill as dismissed / completed. */
  async dismissBackfill(): Promise<void> {
    await setSetting('hasRunAccountBackfill', true);
  },
};
