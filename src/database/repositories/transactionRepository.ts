// Transaction Repository
import { openDatabase, mapTransactionRow, formatCurrency, parseCurrency, generateId, now, runInTransaction } from '../db';
import { Transaction, TransactionStatus, SourceType } from '../schema';

export interface CreateTransactionInput {
  amountPaise: number;
  currency?: string;
  merchant: string;
  transactionTimestamp: number;
  categoryId?: string | null;
  memberId?: string | null;
  note?: string | null;
  status?: TransactionStatus;
  sourceApp?: string | null;
  notificationId?: string | null;
  rawNotification?: string | null;
  parserMetadata?: string | null;
  sourceEventId?: string | null;   // NEW: For idempotency
  sourceType?: SourceType | null;  // NEW: Event source type
  is_pending_capture?: number;     // NEW: 1 = captured UPI event awaiting review
  is_dismissed?: number;           // NEW: 1 = dismissed (rejected/ignored)
  dismissed_at?: number | null;    // NEW: Timestamp when dismissed
}

export interface UpdateTransactionInput {
  amountPaise?: number;
  merchant?: string;
  categoryId?: string | null;
  memberId?: string | null;
  note?: string | null;
  status?: TransactionStatus;
  is_pending_capture?: number;      // NEW: cleared on confirmation
  is_dismissed?: number;           // NEW
  dismissed_at?: number | null;    // NEW
}

export interface TransactionFilters {
  categoryId?: string;
  memberId?: string;
  status?: TransactionStatus;
  startDate?: number;
  endDate?: number;
  search?: string;
  limit?: number;
  offset?: number;
  is_pending_capture?: number;    // NEW
}

export const transactionRepository = {
  // Create a new transaction
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const database = await openDatabase();
    const id = generateId();
    const timestamp = now();
    
    await database.runAsync(
      `INSERT INTO transactions (
        id, amountPaise, currency, merchant, transactionTimestamp,
        categoryId, memberId, note, status, sourceApp,
        notificationId, rawNotification, parserMetadata,
        sourceEventId, sourceType,
        is_pending_capture, is_dismissed, dismissed_at,  -- NEW
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.amountPaise,
        input.currency || 'INR',
        input.merchant,
        input.transactionTimestamp,
        input.categoryId || null,
        input.memberId || null,
        input.note || null,
        input.status || 'PENDING',
        input.sourceApp || null,
        input.notificationId || null,
        input.rawNotification || null,
        input.parserMetadata || null,
        input.sourceEventId || null,
        input.sourceType || null,
        input.is_pending_capture || 0,    // NEW
        input.is_dismissed || 0,          // NEW
        input.dismissed_at || null,       // NEW
        timestamp,
        timestamp,
      ]
    );
    
    const row = await database.getFirstAsync(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    
    return mapTransactionRow(row!);
  },
  
  // Get transaction by ID
  async getById(id: string): Promise<Transaction | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    
    return row ? mapTransactionRow(row) : null;
  },
  
  // Get transaction by notification ID (for deduplication - legacy)
  async getByNotificationId(notificationId: string): Promise<Transaction | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM transactions WHERE notificationId = ?',
      [notificationId]
    );
    
    return row ? mapTransactionRow(row) : null;
  },
  
  // NEW: Get transaction by sourceEventId (for idempotency)
  async getBySourceEventId(sourceEventId: string): Promise<Transaction | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM transactions WHERE sourceEventId = ?',
      [sourceEventId]
    );
    
    return row ? mapTransactionRow(row) : null;
  },
  
  // Update transaction
  async update(id: string, input: UpdateTransactionInput): Promise<Transaction | null> {
    const database = await openDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (input.amountPaise !== undefined) {
      updates.push('amountPaise = ?');
      values.push(input.amountPaise);
    }
    if (input.merchant !== undefined) {
      updates.push('merchant = ?');
      values.push(input.merchant);
    }
    if (input.categoryId !== undefined) {
      updates.push('categoryId = ?');
      values.push(input.categoryId);
    }
    if (input.memberId !== undefined) {
      updates.push('memberId = ?');
      values.push(input.memberId);
    }
    if (input.note !== undefined) {
      updates.push('note = ?');
      values.push(input.note);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.is_pending_capture !== undefined) {
      updates.push('is_pending_capture = ?');
      values.push(input.is_pending_capture);
    }
    if (input.is_dismissed !== undefined) {
      updates.push('is_dismissed = ?');
      values.push(input.is_dismissed);
    }
    if (input.dismissed_at !== undefined) {
      updates.push('dismissed_at = ?');
      values.push(input.dismissed_at);
    }
    
    if (updates.length === 0) {
      return this.getById(id);
    }
    
    updates.push('updatedAt = ?');
    values.push(now());
    values.push(id);
    
    await database.runAsync(
      `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getById(id);
  },
  
  // Delete transaction
  async delete(id: string): Promise<boolean> {
    const database = await openDatabase();
    const result = await database.runAsync(
      'DELETE FROM transactions WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  },
  
  // List transactions with filters
  async list(filters: TransactionFilters = {}): Promise<Transaction[]> {
    const database = await openDatabase();
    
    const conditions: string[] = [];
    const values: any[] = [];
    
    if (filters.categoryId) {
      conditions.push('categoryId = ?');
      values.push(filters.categoryId);
    }
    if (filters.memberId) {
      conditions.push('memberId = ?');
      values.push(filters.memberId);
    }
    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }
    if (filters.is_pending_capture !== undefined) {
      conditions.push('is_pending_capture = ?');
      values.push(filters.is_pending_capture);
    }
    if (filters.startDate) {
      conditions.push('transactionTimestamp >= ?');
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('transactionTimestamp <= ?');
      values.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push('(merchant LIKE ? OR note LIKE ?)');
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    const rows = await database.getAllAsync(
      `SELECT * FROM transactions ${whereClause} ORDER BY transactionTimestamp DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    
    return rows.map(mapTransactionRow);
  },
  
  // Get recent transactions
  async getRecent(limit: number = 10): Promise<Transaction[]> {
    return this.list({ limit, status: 'CONFIRMED' });
  },
  
  // Get pending transactions (awaiting review) - only pending captures that are not dismissed
  async getPending(): Promise<Transaction[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      `SELECT * FROM transactions 
       WHERE status = 'PENDING' 
       AND is_pending_capture = 1 
       AND is_dismissed = 0
       ORDER BY transactionTimestamp DESC`
    );
    
    return rows.map(mapTransactionRow);
  },
  
  // Get dismissed pending transactions
  async getDismissed(): Promise<Transaction[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      `SELECT * FROM transactions 
       WHERE is_dismissed = 1
       ORDER BY dismissed_at DESC`
    );
    
    return rows.map(mapTransactionRow);
  },
  
  // Get confirmed transactions
  async getConfirmed(limit?: number): Promise<Transaction[]> {
    return this.list({ status: 'CONFIRMED', limit });
  },
  
  // Get total spending (confirmed transactions)
  async getTotalSpending(startDate?: number, endDate?: number): Promise<number> {
    const database = await openDatabase();
    
    const conditions: string[] = ["status = 'CONFIRMED'"];
    const values: any[] = [];
    
    if (startDate) {
      conditions.push('transactionTimestamp >= ?');
      values.push(startDate);
    }
    if (endDate) {
      conditions.push('transactionTimestamp <= ?');
      values.push(endDate);
    }
    
    const whereClause = conditions.join(' AND ');
    const row = await database.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amountPaise), 0) as total FROM transactions WHERE ${whereClause}`,
      values
    );
    
    return row?.total || 0;
  },
  
  // Get spending by category
  async getSpendingByCategory(startDate?: number, endDate?: number): Promise<Array<{ categoryId: string; total: number; count: number }>> {
    const database = await openDatabase();
    
    const conditions: string[] = ["status = 'CONFIRMED'", 'categoryId IS NOT NULL'];
    const values: any[] = [];
    
    if (startDate) {
      conditions.push('transactionTimestamp >= ?');
      values.push(startDate);
    }
    if (endDate) {
      conditions.push('transactionTimestamp <= ?');
      values.push(endDate);
    }
    
    const whereClause = conditions.join(' AND ');
    const rows = await database.getAllAsync<{ categoryId: string; total: number; count: number }>(
      `SELECT categoryId, SUM(amountPaise) as total, COUNT(*) as count 
       FROM transactions 
       WHERE ${whereClause} 
       GROUP BY categoryId 
       ORDER BY total DESC`,
      values
    );
    
    return rows;
  },
  
  // Count transactions
  async count(filters: TransactionFilters = {}): Promise<number> {
    const database = await openDatabase();
    
    const conditions: string[] = [];
    const values: any[] = [];
    
    if (filters.categoryId) {
      conditions.push('categoryId = ?');
      values.push(filters.categoryId);
    }
    if (filters.memberId) {
      conditions.push('memberId = ?');
      values.push(filters.memberId);
    }
    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }
    if (filters.is_pending_capture !== undefined) {
      conditions.push('is_pending_capture = ?');
      values.push(filters.is_pending_capture);
    }
    if (filters.startDate) {
      conditions.push('transactionTimestamp >= ?');
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('transactionTimestamp <= ?');
      values.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push('(merchant LIKE ? OR note LIKE ?)');
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
      values
    );
    
    return row?.count || 0;
  },
  
  // Bulk create (for initial seed data)
  async bulkCreate(transactions: CreateTransactionInput[]): Promise<number> {
    return runInTransaction(async () => {
      const database = await openDatabase();
      let count = 0;
      const timestamp = now();
      
      for (const input of transactions) {
        const id = generateId();
        await database.runAsync(
          `INSERT INTO transactions (
            id, amountPaise, currency, merchant, transactionTimestamp,
            categoryId, memberId, note, status, sourceApp,
            notificationId, rawNotification, parserMetadata,
            sourceEventId, sourceType,
            is_pending_capture, is_dismissed, dismissed_at,  -- NEW
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.amountPaise,
            input.currency || 'INR',
            input.merchant,
            input.transactionTimestamp,
            input.categoryId || null,
            input.memberId || null,
            input.note || null,
            input.status || 'PENDING',
            input.sourceApp || null,
            input.notificationId || null,
            input.rawNotification || null,
            input.parserMetadata || null,
            input.sourceEventId || null,
            input.sourceType || null,
            input.is_pending_capture || 0,
            input.is_dismissed || 0,
            input.dismissed_at || null,
            timestamp,
            timestamp,
          ]
        );
        count++;
      }
      
      return count;
    });
  },
  
  // NEW: Create transaction with idempotency check
  async createWithIdempotency(input: CreateTransactionInput): Promise<{ transaction: Transaction; isNew: boolean }> {
    // If sourceEventId provided, check for existing
    if (input.sourceEventId) {
      const existing = await this.getBySourceEventId(input.sourceEventId);
      if (existing) {
        return { transaction: existing, isNew: false };
      }
    }
    
    // Also check notificationId for legacy deduplication
    if (input.notificationId) {
      const existing = await this.getByNotificationId(input.notificationId);
      if (existing) {
        return { transaction: existing, isNew: false };
      }
    }
    
    const transaction = await this.create(input);
    return { transaction, isNew: true };
  },
};