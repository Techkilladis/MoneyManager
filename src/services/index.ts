// Services - Business logic layer connecting repositories to UI

import { CreateTransactionInput, transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { merchantRepository } from '../database/repositories/merchantRepository';
import { formatCurrency, formatDate, FormattedTransaction, HomeData, Category, Member } from '../domain/transaction';
import { initializeDatabase } from '../database/db';
import { seedDevelopmentData } from './seedData';
import { notificationDetectionService, PendingUpiEvent } from './notificationDetection';
import { openDatabase } from '../database/db';
import { dataEvents } from './events';
import { getClassificationSuggestion, recordClassification, recordCorrection, ClassificationSuggestion, getMerchantMemoryStats, shouldPrefill, getPrefillMode } from './classification';
import { normalizeMerchantFull } from './merchantNormalization';
import * as budgetService from './budget';
import * as analyticsService from './analytics';
import * as ledgerService from './ledger';
import * as splitService from './splits';
import * as recurringService from './recurring';
import * as alertsService from './alerts';
import * as recapService from './recap';
import * as backupService from './backup';
import { Transaction, TransactionKind } from '../database/schema';

/** Everything needed to put a deleted transaction back (undo). */
export interface TransactionSnapshot {
  row: Record<string, string | number | null>;
  splits: Record<string, string | number | null>[];
}

/** A native SMS capture as a pending app transaction; the native event id is the idempotency key. */
function captureInput(event: PendingUpiEvent): CreateTransactionInput {
  return {
    amountPaise: Number(event.amountPaise),
    merchant: event.merchant || 'Unknown Merchant',
    transactionTimestamp: event.transactionTimestamp,
    categoryId: null,
    memberId: null,
    note: null,
    status: 'PENDING',
    sourceApp: event.sourceApp,
    notificationId: null,
    sourceEventId: event.id,
    sourceType: 'UPI_NOTIFICATION',
    // Money received (CREDIT) is captured as income.
    kind: event.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE',
    is_pending_capture: 1,
    is_dismissed: 0,
    dismissed_at: null,
    parserMetadata: JSON.stringify({
      parserName: event.parserName,
      parserVersion: event.parserVersion,
      confidence: event.confidence,
    }),
  };
}

function afterSpendingChange() {
  // Fire-and-forget: alerts must never block or fail a save.
  void alertsService.checkBudgetAlerts();
}

export const transactionService = {
  // Initialize database
  async initialize(): Promise<void> {
    await initializeDatabase();

    // Development sample data: only in debug builds, and only once — never
    // on a database that already holds transactions, so real user data
    // (including data created from sample rows) is never overwritten or
    // re-seeded on subsequent launches.
    if (__DEV__) {
      const existingCount = await transactionRepository.count();
      if (existingCount === 0) {
        await seedDevelopmentData();
      }
    }

    // Pull native pending events into the app database (see
    // syncPendingNativeEvents) before recovery so events captured while the
    // JS runtime was down are represented as pending captures.
    await this.syncPendingNativeEvents();

    // Recovery: Handle CONFIRMED transactions that weren't consumed from native
    await this.recoverUnconsumedEvents();
  },

  // Sync native pending UPI events (moneymanager_notifications.db) into the
  // app database as PENDING capture transactions. Idempotent: a native event
  // is never turned into more than one app transaction, keyed by
  // sourceEventId (ADR 001).
  async syncPendingNativeEvents(): Promise<number> {
    try {
      await notificationDetectionService.initialize();

      // Step 1: Immediately sync all existing pending native events
      // (captured in real time by SmsReceiver) so they are in SQLite
      // before doing the heavier inbox scan.
      const initialEvents = await notificationDetectionService.getPendingUpiEvents();
      let created = 0;
      for (const event of initialEvents) {
        try {
          const result = await transactionRepository.createWithIdempotency(captureInput(event));
          if (result.isNew) created++;
        } catch (error) {
          console.warn(`[Sync] Skipped native event ${event.id}:`, error);
        }
      }

      if (created > 0) {
        dataEvents.emit();
      }

      // Step 2: Scan SMS inbox for any missed messages while app was not running
      try {
        const scanRes = await notificationDetectionService.scanSmsInbox();
        if (scanRes.captured > 0) {
          const inboxEvents = await notificationDetectionService.getPendingUpiEvents();
          for (const event of inboxEvents) {
            try {
              const result = await transactionRepository.createWithIdempotency(captureInput(event));
              if (result.isNew) created++;
            } catch (error) {
              console.warn(`[Sync] Skipped native event ${event.id}:`, error);
            }
          }
          if (created > 0) {
            dataEvents.emit();
          }
        }
      } catch (scanError) {
        console.warn('[Sync] SMS inbox scan skipped/failed:', scanError);
      }

      if (created > 0) {
        console.log(`[Sync] Native pending events: synced ${created} new captures`);
      }
      return created;
    } catch (error) {
      // Native ingestion is an enhancement — the app must stay usable when
      // the module is unavailable (e.g. non-Android platforms).
      console.warn('[Sync] Failed to sync native pending events:', error);
      return 0;
    }
  },

  // Recovery: Find CONFIRMED transactions with unconsumed sourceEventId and consume them
  async recoverUnconsumedEvents(): Promise<void> {
    try {
      const database = await openDatabase();
      
      // Find all transactions with a sourceEventId whose native event may
      // still be PENDING: CONFIRMED rows must be consumed, dismissed rows
      // must be dismissed. Both calls are idempotent on the native side.
      const rows = await database.getAllAsync<{ id: string; sourceEventId: string; status: string; is_dismissed: number }>(
        `SELECT id, sourceEventId, status, is_dismissed FROM transactions 
         WHERE sourceEventId IS NOT NULL 
         AND sourceEventId != ''
         AND (status = 'CONFIRMED' OR is_dismissed = 1)`
      );

      if (rows.length > 0) {
        console.log(`[Recovery] Found ${rows.length} settled transactions with sourceEventId, reconciling native event state...`);
        
        for (const row of rows) {
          try {
            if (row.status === 'CONFIRMED') {
              // Try to consume - if already consumed, this is idempotent
              await notificationDetectionService.consumePendingUpiEvent(row.sourceEventId);
              console.log(`[Recovery] Consumed native event for transaction ${row.id}: ${row.sourceEventId}`);
            } else {
              // Dismissed pending capture - mark the native event dismissed
              await notificationDetectionService.dismissPendingUpiEvent(row.sourceEventId);
              console.log(`[Recovery] Dismissed native event for transaction ${row.id}: ${row.sourceEventId}`);
            }
          } catch (err) {
            // If the native call fails (e.g. event not found natively), that's
            // OK - it was likely already settled on a previous run.
            console.log(`[Recovery] Native reconcile for ${row.sourceEventId} returned:`, err);
          }
        }
      }
    } catch (error) {
      console.error('[Recovery] Failed to recover unconsumed events:', error);
    }
  },

  // Get home screen data - separated confirmed vs pending
  async getHomeData(): Promise<HomeData> {
    const [
      totalSpending,
      pendingTransactions,
      recentTransactions,
    ] = await Promise.all([
      transactionRepository.getTotalSpending(),
      transactionRepository.getPending(),
      transactionRepository.getRecent(5),
    ]);

    // Count from the same filtered set shown to the user (getPending
    // excludes dismissed captures), so count and total can never disagree.
    const pendingCount = pendingTransactions.length;
    const pendingTotal = pendingTransactions.reduce((sum, t) => sum + t.amountPaise, 0);

    return {
      totalSpending,
      totalSpendingFormatted: formatCurrency(totalSpending),
      pendingCount,
      pendingTotal,
      pendingTotalFormatted: formatCurrency(pendingTotal),
      recentTransactions: recentTransactions.map(this.formatTransaction),
      pendingTransactions: pendingTransactions.map(this.formatTransaction),
    };
  },

  // Format transaction for UI
  formatTransaction(tx: any): FormattedTransaction {
    const { date, time } = formatDate(tx.transactionTimestamp);

    return {
      id: tx.id,
      amount: formatCurrency(tx.amountPaise, tx.currency),
      amountPaise: tx.amountPaise,
      currency: tx.currency,
      merchant: tx.merchant,
      date,
      time,
      timestamp: tx.transactionTimestamp,
      category: null,
      member: null,
      note: tx.note,
      status: tx.status,
      sourceApp: tx.sourceApp,
      sourceEventId: tx.sourceEventId,
      sourceType: tx.sourceType,
      is_pending_capture: tx.is_pending_capture ?? 0,
      is_dismissed: tx.is_dismissed ?? 0,
      dismissed_at: tx.dismissed_at ?? null,
      kind: tx.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
      sharedPaise: tx.sharedPaise ?? 0,
    };
  },

  // The capture pop-up's review screen: the app transaction for one native
  // event, created on the spot when the app hasn't synced it yet. Null when
  // the event is unknown or was already settled before it reached the app.
  async ensureCaptureForEvent(sourceEventId: string): Promise<Transaction | null> {
    const existing = await transactionRepository.getBySourceEventId(sourceEventId);
    // Only return transactions that are still pending review. A background sync may have
    // already created this transaction and the user could have reviewed it by now — in
    // which case returning it would cause quick-capture to show "Nothing to review" with
    // an empty queue even though other pending payments exist. (Race condition fix.)
    if (existing && existing.status === 'PENDING') return existing;
    await notificationDetectionService.initialize();
    const event = await notificationDetectionService.getPendingUpiEvent(sourceEventId);
    if (!event || event.status !== 'PENDING') return null;
    try {
      return (await transactionRepository.createWithIdempotency(captureInput(event))).transaction;
    } catch (error) {
      // A background sync can insert the same event first (unique sourceEventId).
      console.warn('[Capture] Create raced with sync:', error);
      return transactionRepository.getBySourceEventId(sourceEventId);
    }
  },

  // Resolve a pending capture by its native event id (deep-link path).
  // Returns null when the event has no matching transaction (invalid or
  // already-settled event id), which callers surface as a graceful error.
  async getPendingCaptureBySourceEventId(sourceEventId: string): Promise<FormattedTransaction | null> {
    const tx = await transactionRepository.getBySourceEventId(sourceEventId);
    if (!tx) return null;
    return this.getFormattedTransaction(tx.id);
  },

  // Oldest pending capture awaiting review (FIFO), used when Quick Capture
  // is opened without parameters.
  async getOldestPendingCapture(): Promise<FormattedTransaction | null> {
    const pending = await transactionRepository.getPending();
    if (pending.length === 0) return null;
    const oldest = pending[pending.length - 1]; // list is ordered newest first
    return this.getFormattedTransaction(oldest.id);
  },

  // Get formatted transaction with category and member
  async getFormattedTransaction(id: string): Promise<FormattedTransaction | null> {
    const tx = await transactionRepository.getById(id);
    if (!tx) return null;
    const [category, member] = await Promise.all([
      tx.categoryId ? categoryRepository.getById(tx.categoryId) : Promise.resolve(null),
      tx.memberId ? memberRepository.getById(tx.memberId) : Promise.resolve(null),
    ]);

    const { date, time } = formatDate(tx.transactionTimestamp);

    return {
      id: tx.id,
      amount: formatCurrency(tx.amountPaise, tx.currency),
      amountPaise: tx.amountPaise,
      currency: tx.currency,
      merchant: tx.merchant,
      date,
      time,
      timestamp: tx.transactionTimestamp,
      category: category ? {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      } : null,
      member: member ? {
        id: member.id,
        name: member.name,
        color: member.color,
      } : null,
      note: tx.note,
      status: tx.status,
      sourceApp: tx.sourceApp,
      sourceEventId: tx.sourceEventId,
      sourceType: tx.sourceType,
      is_pending_capture: tx.is_pending_capture ?? 0,
      is_dismissed: tx.is_dismissed ?? 0,
      dismissed_at: tx.dismissed_at ?? null,
      kind: tx.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
      sharedPaise: tx.sharedPaise ?? 0,
    };
  },

  // Get all transactions with category and member data
  async getFormattedTransactions(filters: any = {}): Promise<FormattedTransaction[]> {
    const transactions = await transactionRepository.list(filters);

    // Fetch all unique category and member IDs
    const categoryIds = [...new Set(transactions.map(t => t.categoryId).filter(Boolean))];
    const memberIds = [...new Set(transactions.map(t => t.memberId).filter(Boolean))];

    const [categories, members] = await Promise.all([
      Promise.all(categoryIds.map(id => categoryRepository.getById(id!))),
      Promise.all(memberIds.map(id => memberRepository.getById(id!))),
    ]);

    const categoryMap = new Map(categories.filter(Boolean).map(c => [c!.id, c!]));
    const memberMap = new Map(members.filter(Boolean).map(m => [m!.id, m!]));

    return transactions.map(tx => {
      const { date, time } = formatDate(tx.transactionTimestamp);
      const category = tx.categoryId ? categoryMap.get(tx.categoryId) || null : null;
      const member = tx.memberId ? memberMap.get(tx.memberId) || null : null;

      return {
        id: tx.id,
        amount: formatCurrency(tx.amountPaise, tx.currency),
        amountPaise: tx.amountPaise,
        currency: tx.currency,
        merchant: tx.merchant,
        date,
        time,
        timestamp: tx.transactionTimestamp,
        category: category ? {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
        } : null,
        member: member ? {
          id: member.id,
          name: member.name,
          color: member.color,
        } : null,
        note: tx.note,
        status: tx.status,
        sourceApp: tx.sourceApp,
        sourceEventId: tx.sourceEventId,
        sourceType: tx.sourceType,
        is_pending_capture: tx.is_pending_capture ?? 0,
        is_dismissed: tx.is_dismissed ?? 0,
        dismissed_at: tx.dismissed_at ?? null,
        kind: tx.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
        sharedPaise: tx.sharedPaise ?? 0,
      };
    });
  },

  // Create transaction
  async createTransaction(input: any) {
    return transactionRepository.create(input);
  },

  // Manually entered expense: stored as CONFIRMED and taught to merchant
  // memory so the next payment to the same merchant is pre-classified.
  async createManualTransaction(input: {
    amountPaise: number;
    merchant: string;
    transactionTimestamp: number;
    categoryId: string | null;
    memberId: string | null;
    note: string | null;
    kind?: TransactionKind;
  }) {
    const tx = await transactionRepository.create({
      ...input,
      kind: input.kind ?? 'EXPENSE',
      currency: 'INR',
      status: 'CONFIRMED',
      sourceApp: 'Manual',
      sourceType: 'MANUAL',
      is_pending_capture: 0,
      is_dismissed: 0,
    });
    await this.learnMerchant(input.merchant, input.categoryId, input.memberId);
    if (tx.kind === 'EXPENSE') afterSpendingChange();
    return tx;
  },

  // Edit an existing transaction (any field, including the timestamp).
  // Category/member changes update merchant memory.
  async editTransaction(
    id: string,
    input: {
      amountPaise: number;
      merchant: string;
      transactionTimestamp: number;
      categoryId: string | null;
      memberId: string | null;
      note: string | null;
      kind?: TransactionKind;
    }
  ) {
    const existing = await transactionRepository.getById(id);
    if (!existing) throw new Error('Transaction not found');

    const kind = input.kind ?? existing.kind;
    const updated = await transactionRepository.update(id, {
      amountPaise: input.amountPaise,
      merchant: input.merchant,
      categoryId: input.categoryId,
      memberId: input.memberId,
      note: input.note,
      kind,
    });
    if (kind === 'INCOME' && existing.sharedPaise > 0) {
      await splitService.setSplits(id, []);
    } else if (input.amountPaise !== existing.amountPaise && existing.sharedPaise > 0) {
      await splitService.rescaleSplits(id, existing.amountPaise, input.amountPaise);
    }
    if (input.transactionTimestamp !== existing.transactionTimestamp) {
      const database = await openDatabase();
      await database.runAsync(
        'UPDATE transactions SET transactionTimestamp = ?, updatedAt = ? WHERE id = ?',
        [input.transactionTimestamp, Date.now(), id]
      );
    }
    if (input.categoryId !== existing.categoryId || input.memberId !== existing.memberId) {
      await this.learnMerchant(input.merchant, input.categoryId, input.memberId);
    }
    afterSpendingChange();
    return updated;
  },

  /** Deletes a confirmed transaction and returns what's needed to undo it. */
  async deleteWithUndo(id: string): Promise<{ success: boolean; snapshot?: TransactionSnapshot; error?: string }> {
    const database = await openDatabase();
    const row = await database.getFirstAsync<TransactionSnapshot['row']>('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!row) return { success: false, error: 'Transaction not found' };
    if (row.is_pending_capture) {
      return { success: false, error: 'Cannot delete pending capture transaction. Use dismiss instead.' };
    }
    const splits = await database.getAllAsync<TransactionSnapshot['row']>('SELECT * FROM splits WHERE transaction_id = ?', [id]);
    await transactionRepository.delete(id);
    afterSpendingChange();
    return { success: true, snapshot: { row, splits } };
  },

  async restoreTransaction(snapshot: TransactionSnapshot): Promise<void> {
    const database = await openDatabase();
    const insert = async (table: string, row: TransactionSnapshot['row']) => {
      const cols = Object.keys(row);
      await database.runAsync(
        `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => row[c] ?? null)
      );
    };
    await database.withTransactionAsync(async () => {
      await insert('transactions', snapshot.row);
      for (const split of snapshot.splits) await insert('splits', split);
    });
    afterSpendingChange();
  },

  async learnMerchant(merchantName: string, categoryId: string | null, memberId: string | null) {
    if (!merchantName.trim() || (!categoryId && !memberId)) return;
    try {
      const { normalizedKey, canonicalName } = normalizeMerchantFull(merchantName);
      const merchant = await merchantRepository.getOrCreateByNormalizedKey(normalizedKey, canonicalName);
      await recordClassification(merchant.id, categoryId, memberId, 'USER_CONFIRMED');
    } catch (error) {
      console.warn('[transactionService] Failed to record merchant memory:', error);
    }
  },

  // Create transaction with idempotency (for UPI notifications)
  async createTransactionWithIdempotency(input: any) {
    return transactionRepository.createWithIdempotency(input);
  },

  // Update transaction
  async updateTransaction(id: string, input: any) {
    return transactionRepository.update(id, input);
  },

  // Delete transaction - only allow deleting non-pending-capture transactions
  async deleteTransaction(id: string) {
    const existing = await transactionRepository.getById(id);
    if (existing?.is_pending_capture) {
      return { success: false, error: 'Cannot delete pending capture transaction. Use dismiss instead.' };
    }
    return transactionRepository.delete(id);
  },

  // Confirm pending transaction - full workflow with idempotency
  async confirmTransaction(
    id: string, 
    categoryId?: string, 
    memberId?: string,
    amountPaise?: number,
    merchant?: string,
    note?: string
  ): Promise<{ success: boolean; transaction?: any; error?: string }> {
    try {
      // First check if already confirmed (idempotency)
      const existing = await transactionRepository.getById(id);
      if (!existing) {
        return { success: false, error: 'Transaction not found' };
      }
      
      if (existing.status === 'CONFIRMED') {
        return { success: true, transaction: existing, error: 'Already confirmed' };
      }

      // Use transaction for atomicity: update status + consume native
      // We update DB first, then consume native. Recovery logic handles crashes.
      // Clearing is_pending_capture moves the confirmed capture into the
      // normal transaction list (which excludes pending captures).
      const updated = await transactionRepository.update(id, {
        status: 'CONFIRMED',
        is_pending_capture: 0,
        categoryId: categoryId || undefined,
        memberId: memberId || undefined,
        amountPaise: amountPaise !== undefined ? amountPaise : undefined,
        merchant: merchant !== undefined ? merchant : undefined,
        note: note !== undefined ? note : undefined,
      });

      // If this has a sourceEventId, consume the native pending event
      if (existing.sourceEventId) {
        await notificationDetectionService.consumePendingUpiEvent(existing.sourceEventId);
      }

      // Record classification for merchant memory (Phase 5)
      if (existing.merchant && (categoryId || memberId)) {
        try {
          const merchant = await merchantRepository.getOrCreateByNormalizedKey(
            normalizeMerchantFull(existing.merchant).normalizedKey,
            normalizeMerchantFull(existing.merchant).canonicalName
          );
          await recordClassification(merchant.id, categoryId || null, memberId || null, 'USER_CONFIRMED');
        } catch (memoryError) {
          console.warn('[transactionService] Failed to record merchant memory:', memoryError);
          // Don't fail the confirmation if memory recording fails
        }
      }

      if (existing.kind === 'EXPENSE') afterSpendingChange();
      return { success: true, transaction: updated };
    } catch (error) {
      console.error('[transactionService] Confirm failed:', error);
      return { success: false, error: 'Failed to confirm transaction' };
    }
  },

  // Dismiss pending transaction - uses is_dismissed flag instead of CANCELLED status
  async dismissTransaction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await transactionRepository.getById(id);
      if (!existing) {
        return { success: false, error: 'Transaction not found' };
      }

      // Mark as dismissed (semantically: rejected/ignored, not cancelled)
      const timestamp = Date.now();
      await transactionRepository.update(id, { 
        is_dismissed: 1,
        dismissed_at: timestamp,
        // Keep status as PENDING for semantic clarity
        // status: 'PENDING' - unchanged
      });

      if (existing.sourceEventId) {
        await notificationDetectionService.dismissPendingUpiEvent(existing.sourceEventId);
      }

      return { success: true };
    } catch (error) {
      console.error('[transactionService] Dismiss failed:', error);
      return { success: false, error: 'Failed to dismiss transaction' };
    }
  },

  // Undo a dismissed transaction - restores it back to pending state
  async undismissTransaction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await transactionRepository.getById(id);
      if (!existing) {
        return { success: false, error: 'Transaction not found' };
      }

      await transactionRepository.update(id, {
        is_dismissed: 0,
        dismissed_at: null,
      });

      return { success: true };
    } catch (error) {
      console.error('[transactionService] Undismiss failed:', error);
      return { success: false, error: 'Failed to restore transaction' };
    }
  },

  // Parse a sample bank SMS for testing (nothing is stored).
  async simulateUpiSms() {
    return notificationDetectionService.simulateSms(
      'AX-HDFCBK',
      'Rs.250.00 debited from a/c **1234 on 12-10-24 to VPA testmerchant@ybl(UPI Ref No 412345678901)'
    );
  },
};

type Result = { success: boolean; error?: string };

function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint/i.test(message)) return 'That name is already in use';
  return fallback;
}

export const categoryService = {
  async getAll(): Promise<Category[]> {
    return categoryRepository.getAll();
  },

  async getById(id: string) {
    return categoryRepository.getById(id);
  },

  async create(input: { name: string; icon: string; color: string; kind?: TransactionKind }): Promise<Result> {
    const name = input.name.trim();
    if (!name) return { success: false, error: 'Enter a category name' };
    try {
      const all = await categoryRepository.getAll();
      const sortOrder = all.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
      await categoryRepository.create({ name, icon: input.icon, color: input.color, sortOrder, kind: input.kind ?? 'EXPENSE' });
      return { success: true };
    } catch (error) {
      return { success: false, error: friendlyError(error, 'Could not create category') };
    }
  },

  async update(id: string, input: { name: string; icon: string; color: string }): Promise<Result> {
    const name = input.name.trim();
    if (!name) return { success: false, error: 'Enter a category name' };
    try {
      await categoryRepository.update(id, { ...input, name });
      return { success: true };
    } catch (error) {
      return { success: false, error: friendlyError(error, 'Could not update category') };
    }
  },

  /** Puts a deleted category back with its original id (undo). */
  async restore(category: Category): Promise<void> {
    const database = await openDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO categories (id, name, icon, color, sortOrder, kind, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [category.id, category.name, category.icon, category.color, category.sortOrder, category.kind, category.createdAt, Date.now()]
    );
  },

  async delete(id: string): Promise<Result> {
    try {
      await categoryRepository.delete(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: /Cannot delete/i.test(String(error))
          ? 'This category is used by transactions. Move them to another category first.'
          : 'Could not delete category',
      };
    }
  },
};

export const memberService = {
  async getAll(): Promise<Member[]> {
    return memberRepository.getAll();
  },

  async getDefaults(): Promise<Member[]> {
    return memberRepository.getDefaults();
  },

  async getById(id: string) {
    return memberRepository.getById(id);
  },

  async create(input: { name: string; color: string }): Promise<Result> {
    const name = input.name.trim();
    if (!name) return { success: false, error: 'Enter a name' };
    try {
      await memberRepository.create({ name, color: input.color, isDefault: false });
      return { success: true };
    } catch (error) {
      return { success: false, error: friendlyError(error, 'Could not add member') };
    }
  },

  async update(id: string, input: { name: string; color: string }): Promise<Result> {
    const name = input.name.trim();
    if (!name) return { success: false, error: 'Enter a name' };
    try {
      await memberRepository.update(id, { ...input, name });
      return { success: true };
    } catch (error) {
      return { success: false, error: friendlyError(error, 'Could not update member') };
    }
  },

  async delete(id: string): Promise<Result> {
    try {
      await memberRepository.delete(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: /Cannot delete/i.test(String(error))
          ? "This person is assigned to transactions, so they can't be removed."
          : 'Could not delete member',
      };
    }
  },
};

export const merchantService = {
  async getOrCreateByNormalizedKey(normalizedKey: string, canonicalName: string) {
    return merchantRepository.getOrCreateByNormalizedKey(normalizedKey, canonicalName);
  },

  async getById(id: string) {
    return merchantRepository.getById(id);
  },

  async getByNormalizedKey(normalizedKey: string) {
    return merchantRepository.getByNormalizedKey(normalizedKey);
  },

  async search(query: string, limit?: number) {
    return merchantRepository.search(query, limit);
  },

  async getAll(): Promise<any[]> {
    return merchantRepository.getAll();
  },
};

export const classificationService = {
  async getSuggestion(input: {
    merchant: string;
    amountPaise?: number;
    categoryId?: string | null;
    memberId?: string | null;
    sourceEventId?: string;
  }): Promise<{ suggestion: ClassificationSuggestion | null; merchant: { id: string; canonicalName: string; normalizedKey: string } }> {
    return getClassificationSuggestion(input);
  },

  async recordClassification(merchantId: string, categoryId: string | null, memberId: string | null, source?: 'USER_CONFIRMED' | 'SYSTEM_DEFAULT') {
    return recordClassification(merchantId, categoryId, memberId, source);
  },

  async recordCorrection(merchantId: string, oldCategoryId: string | null, oldMemberId: string | null, newCategoryId: string | null, newMemberId: string | null) {
    return recordCorrection(merchantId, oldCategoryId, oldMemberId, newCategoryId, newMemberId);
  },

  async getMemoryStats(merchantId: string) {
    return getMerchantMemoryStats(merchantId);
  },

  shouldPrefill,
  getPrefillMode,
};

// Export all services
export const services = {
  transaction: transactionService,
  category: categoryService,
  member: memberService,
  notification: notificationDetectionService,
  classification: classificationService,
  merchant: merchantService,
  budget: budgetService,
  analytics: analyticsService,
  ledger: ledgerService,
  splits: splitService,
  recurring: recurringService,
  alerts: alertsService,
  recap: recapService,
  backup: backupService,
};

// Export individual services for direct imports
export { budgetService };
export { analyticsService };
export { ledgerService };
export { splitService, recurringService, alertsService, recapService, backupService };