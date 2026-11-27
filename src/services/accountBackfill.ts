import { openDatabase } from '@/database/db';
import { accountRepository } from '@/database/repositories/accountRepository';
import { bankNamesMatch, extractPendingAccount, findMatchingAccount } from '@/domain/account';
import { notificationDetectionService, PendingUpiEvent } from './notificationDetection';
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

interface UnassignedConfirmedRow {
  id: string;
  sourceEventId: string | null;
  amountPaise: number;
  kind: string;
  transactionTimestamp: number;
  rawNotification: string | null;
  parserMetadata: string | null;
  sourceApp: string | null;
}

/** Extracts account mask & bank name from metadata, raw SMS, or native event history. */
function resolveRowAccountHints(
  row: UnassignedConfirmedRow,
  nativeById: Map<string, PendingUpiEvent>,
  nativeEvents: PendingUpiEvent[]
): { mask: string | null; bankName: string | null; fromNative: boolean } {
  const pending = extractPendingAccount(row.parserMetadata);
  if (pending?.mask) {
    return { mask: pending.mask, bankName: pending.bankName ?? null, fromNative: false };
  }

  if (row.rawNotification) {
    const mask = extractAccountMask(row.rawNotification);
    if (mask) {
      return { mask, bankName: extractBankName(row.rawNotification, row.sourceApp), fromNative: false };
    }
  }

  const byId = row.sourceEventId ? nativeById.get(row.sourceEventId) : undefined;
  if (byId?.accountMask) {
    return { mask: byId.accountMask, bankName: byId.bankName ?? null, fromNative: true };
  }

  const byFuzzy = nativeEvents.find(
    (ev) =>
      ev.accountMask &&
      ev.amountPaise === row.amountPaise &&
      (ev.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE') === row.kind &&
      Math.abs(ev.transactionTimestamp - row.transactionTimestamp) < 300_000
  );
  if (byFuzzy?.accountMask) {
    return { mask: byFuzzy.accountMask, bankName: byFuzzy.bankName ?? null, fromNative: true };
  }

  return { mask: null, bankName: null, fromNative: false };
}

async function loadNativeEventLookup(rows: UnassignedConfirmedRow[]): Promise<{
  byId: Map<string, PendingUpiEvent>;
  all: PendingUpiEvent[];
}> {
  const needsNative = rows.some((r) => !extractPendingAccount(r.parserMetadata)?.mask && !r.rawNotification);
  if (!needsNative) return { byId: new Map(), all: [] };
  const all = await notificationDetectionService.getAllPendingUpiEvents().catch(() => []);
  const byId = new Map<string, PendingUpiEvent>();
  for (const ev of all) byId.set(ev.id, ev);
  return { byId, all };
}

export const accountBackfillService = {
  /** Check if the historical account backfill has already completed. */
  async isBackfillCompleted(): Promise<boolean> {
    return getSetting('hasRunAccountBackfill');
  },

  /**
   * Scans confirmed transactions with rawNotification text, parser metadata, or native event history.
   * Auto-links transactions to matching existing accounts without modifying status or timestamps.
   * Collects unique unconfigured accounts that need user configuration.
   */
  async runAutoBackfill(options?: BackfillOptions): Promise<{ linkedCount: number; unconfigured: DiscoveredAccount[] }> {
    const isDone = await this.isBackfillCompleted();
    if (isDone && !options?.force) {
      return { linkedCount: 0, unconfigured: [] };
    }

    const db = await openDatabase();
    const rows = await db.getAllAsync<UnassignedConfirmedRow>(
      `SELECT id, sourceEventId, amountPaise, kind, transactionTimestamp, rawNotification, parserMetadata, sourceApp
       FROM transactions
       WHERE status = 'CONFIRMED' AND (accountId IS NULL OR accountId = '' OR accountId = 'account-cash')`
    );

    const [accounts, nativeLookup] = await Promise.all([
      accountRepository.getAll(),
      loadNativeEventLookup(rows),
    ]);
    let linkedCount = 0;
    const unconfiguredMap = new Map<string, DiscoveredAccount>();

    for (const row of rows) {
      const { mask, bankName, fromNative } = resolveRowAccountHints(row, nativeLookup.byId, nativeLookup.all);
      if (!mask) continue;

      const matched = findMatchingAccount(accounts, bankName, mask);
      if (matched) {
        await db.runAsync('UPDATE transactions SET accountId = ? WHERE id = ?', [matched.id, row.id]);
        linkedCount++;
      } else {
        // Persist recovered pendingAccount hints so later account setup and History/Insights stay in sync.
        if (fromNative && !extractPendingAccount(row.parserMetadata)?.mask) {
          let metaObj: Record<string, unknown> = {};
          if (row.parserMetadata) {
            try {
              metaObj = JSON.parse(row.parserMetadata) as Record<string, unknown>;
            } catch {
              metaObj = {};
            }
          }
          metaObj.pendingAccount = { bankName: bankName || undefined, mask };
          await db.runAsync('UPDATE transactions SET parserMetadata = ? WHERE id = ?', [
            JSON.stringify(metaObj),
            row.id,
          ]);
        }

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
   * Once an account is created, completes backfill for all matching confirmed and pending transactions.
   */
  async completeBackfillForAccount(
    bankName: string | undefined,
    mask: string,
    accountId: string
  ): Promise<number> {
    const db = await openDatabase();
    const rows = await db.getAllAsync<UnassignedConfirmedRow>(
      `SELECT id, sourceEventId, amountPaise, kind, transactionTimestamp, rawNotification, parserMetadata, sourceApp
       FROM transactions
       WHERE status = 'CONFIRMED' AND (accountId IS NULL OR accountId = '' OR accountId = 'account-cash')`
    );

    const [accounts, nativeLookup] = await Promise.all([
      accountRepository.getAll(),
      loadNativeEventLookup(rows),
    ]);
    let updatedCount = 0;
    const normMask = mask.trim();

    for (const row of rows) {
      const { mask: rowMask, bankName: rowBank } = resolveRowAccountHints(row, nativeLookup.byId, nativeLookup.all);
      if (!rowMask || rowMask.trim() !== normMask) continue;

      const resolved = findMatchingAccount(accounts, rowBank, rowMask);
      if (resolved?.id === accountId || bankNamesMatch(bankName, rowBank)) {
        await db.runAsync('UPDATE transactions SET accountId = ? WHERE id = ?', [accountId, row.id]);
        updatedCount++;
      }
    }

    // Synchronously update pending captures
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transactionService } = require('./index');
    const pendingUpdated = await transactionService.assignAccountToPending(bankName, normMask, accountId);

    // Re-check if any unconfigured remain
    const remaining = await this.runAutoBackfill({ force: true });
    if (remaining.unconfigured.length === 0) {
      await setSetting('hasRunAccountBackfill', true);
    }

    if (updatedCount > 0 || pendingUpdated > 0) {
      dataEvents.emit();
    }

    return updatedCount;
  },

  /** Mark backfill as dismissed / completed. */
  async dismissBackfill(): Promise<void> {
    await setSetting('hasRunAccountBackfill', true);
  },
};
