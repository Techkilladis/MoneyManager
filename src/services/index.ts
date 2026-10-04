// Services - Business logic layer connecting repositories to UI

import { transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { merchantRepository } from '../database/repositories/merchantRepository';
import { merchantMemoryRepository } from '../database/repositories/merchantMemoryRepository';
import { formatCurrency, formatDate, FormattedTransaction, HomeData, SourceType } from '../domain/transaction';
import { initializeDatabase } from '../database/db';
import { seedDevelopmentData } from './seedData';
import { notificationDetectionService } from './notificationDetection';
import { openDatabase } from '../database/db';
import { getClassificationSuggestion, recordClassification, recordCorrection, ClassificationSuggestion, getMerchantMemoryStats, shouldPrefill, getPrefillMode } from './classification';
import { normalizeMerchantFull } from './merchantNormalization';
import * as budgetService from './budget';
import * as analyticsService from './analytics';
import { localAIProvider } from './localAIProvider';
import { providerRegistry } from './aiClassificationProvider';
import { mockLocalAIProvider } from './mockAIProvider';

export const transactionService = {
  // Initialize database
  async initialize(): Promise<void> {
    await initializeDatabase();
    await seedDevelopmentData();
    // Register AI providers: real llama.cpp provider first (preferred), mock as fallback
    setTimeout(async () => {
      try {
        const { providerRegistry } = require('./aiClassificationProvider');
        const { localAIProvider } = require('./localAIProvider');
        const { mockLocalAIProvider } = require('./mockAIProvider');
        
        // Register real provider first (preferred)
        providerRegistry.register(localAIProvider);
        
        // Register mock as fallback
        providerRegistry.register(mockLocalAIProvider);
        
        // Set active provider to real one, initialize it
        providerRegistry.setActive(localAIProvider.providerId);
        const initResult = await localAIProvider.initialize();
        if (!initResult.success) {
          console.warn('[transactionService] Real AI provider failed to initialize, falling back to mock:', initResult.error);
          providerRegistry.setActive(mockLocalAIProvider.providerId);
          await providerRegistry.initializeAll();
        } else {
          await providerRegistry.initializeAll();
        }
      } catch (error) {
        console.warn('[transactionService] AI provider registration failed, using mock:', error);
        try {
          const { providerRegistry } = require('./aiClassificationProvider');
          const { mockLocalAIProvider } = require('./mockAIProvider');
          providerRegistry.register(mockLocalAIProvider);
          providerRegistry.setActive(mockLocalAIProvider.providerId);
          await providerRegistry.initializeAll();
        } catch (fallbackError) {
          console.error('[transactionService] Even mock provider failed:', fallbackError);
        }
      }
    }, 0);
    // Recovery: Handle CONFIRMED transactions that weren't consumed from native
    await this.recoverUnconsumedEvents();
  },

  // Recovery: Find CONFIRMED transactions with unconsumed sourceEventId and consume them
  async recoverUnconsumedEvents(): Promise<void> {
    try {
      const database = await openDatabase();
      
      // Find all CONFIRMED transactions with sourceEventId that might not have been consumed
      const rows = await database.getAllAsync<{ id: string; sourceEventId: string }>(
        `SELECT id, sourceEventId FROM transactions 
         WHERE status = 'CONFIRMED' 
         AND sourceEventId IS NOT NULL 
         AND sourceEventId != ''`
      );

      if (rows.length > 0) {
        console.log(`[Recovery] Found ${rows.length} confirmed transactions with sourceEventId, checking native consumption...`);
        
        for (const row of rows) {
          try {
            // Try to consume - if already consumed, this is idempotent
            await notificationDetectionService.consumePendingUpiEvent(row.sourceEventId);
            console.log(`[Recovery] Consumed native event for transaction ${row.id}: ${row.sourceEventId}`);
          } catch (err) {
            // If consume fails (e.g., event not found in native), that's OK - might already be consumed
            console.log(`[Recovery] Native consume for ${row.sourceEventId} returned:`, err);
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
      pendingCount,
    ] = await Promise.all([
      transactionRepository.getTotalSpending(),
      transactionRepository.getPending(),
      transactionRepository.getRecent(5),
      transactionRepository.count({ 
        status: 'PENDING', 
        is_pending_capture: 1  // Only pending captures, not dismissed
      }),
    ]);

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
    };
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
      };
    });
  },

  // Create transaction
  async createTransaction(input: any) {
    return transactionRepository.create(input);
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
    const database = await openDatabase();
    
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
      const updated = await transactionRepository.update(id, {
        status: 'CONFIRMED',
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

  // Simulate UPI notification for testing
  async simulateUpiNotification() {
    return notificationDetectionService.simulateUpiNotification({
      notificationId: `test-${Date.now()}`,
      packageName: 'com.google.android.apps.nbu.paisa.user',
      title: 'Payment Successful',
      text: '₹250.00 paid to Test Merchant via Google Pay',
      bigText: '₹250.00 paid to Test Merchant via Google Pay. Reference: TEST123',
      postTime: Date.now(),
    });
  },
};

export const categoryService = {
  async getAll(): Promise<any[]> {
    return categoryRepository.getAll();
  },

  async getById(id: string) {
    return categoryRepository.getById(id);
  },

  async create(input: any) {
    return categoryRepository.create(input);
  },

  async update(id: string, input: any) {
    return categoryRepository.update(id, input);
  },

  async delete(id: string) {
    return categoryRepository.delete(id);
  },
};

export const memberService = {
  async getAll(): Promise<any[]> {
    return memberRepository.getAll();
  },

  async getDefaults(): Promise<any[]> {
    return memberRepository.getDefaults();
  },

  async getById(id: string) {
    return memberRepository.getById(id);
  },

  async create(input: any) {
    return memberRepository.create(input);
  },

  async update(id: string, input: any) {
    return memberRepository.update(id, input);
  },

  async delete(id: string) {
    return memberRepository.delete(id);
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

  async recordClassification(merchantId: string, categoryId: string | null, memberId: string | null, source?: 'USER_CONFIRMED' | 'SYSTEM_DEFAULT' | 'AI_SUGGESTED') {
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
};