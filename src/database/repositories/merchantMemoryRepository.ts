// Merchant Memory Repository
import { openDatabase, mapMerchantMemoryRow, generateId, now, runInTransaction } from '../db';
import { MerchantMemory, MerchantMemorySource, MerchantMemoryConfidence } from '../schema';

export interface CreateMerchantMemoryInput {
  merchantId: string;
  categoryId?: string | null;
  memberId?: string | null;
  source: MerchantMemorySource;
  confidence: MerchantMemoryConfidence;
}

export interface UpdateMerchantMemoryInput {
  categoryId?: string | null;
  memberId?: string | null;
  source?: MerchantMemorySource;
  confidence?: MerchantMemoryConfidence;
  usageCount?: number;
  lastUsedAt?: number;
}

export interface MerchantMemoryFilters {
  merchantId?: string;
  categoryId?: string;
  memberId?: string;
  source?: MerchantMemorySource;
}

export const merchantMemoryRepository = {
  // Create a new merchant memory entry
  async create(input: CreateMerchantMemoryInput): Promise<MerchantMemory> {
    const database = await openDatabase();
    const id = generateId();
    const timestamp = now();
    
    await database.runAsync(
      `INSERT INTO merchant_memory (
        id, merchant_id, category_id, member_id, source, confidence,
        usage_count, last_used_at, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.merchantId,
        input.categoryId || null,
        input.memberId || null,
        input.source,
        input.confidence,
        1, // usage_count
        timestamp, // last_used_at
        timestamp,
        timestamp,
      ]
    );
    
    const row = await database.getFirstAsync(
      'SELECT * FROM merchant_memory WHERE id = ?',
      [id]
    );
    
    return mapMerchantMemoryRow(row!);
  },
  
  // Get or create merchant memory (idempotent for merchant+category+member combination)
  async getOrCreate(input: CreateMerchantMemoryInput): Promise<{ memory: MerchantMemory; isNew: boolean }> {
    // Check if exact combination exists
    const existing = await this.getByMerchantCategoryMember(
      input.merchantId,
      input.categoryId || null,
      input.memberId || null
    );
    
    if (existing) {
      // Update usage count and last used
      await this.incrementUsage(existing.id);
      return { memory: existing, isNew: false };
    }
    
    // Check if there's an entry with same merchant+category but different member (or vice versa)
    // We allow multiple entries for the same merchant with different category/member combos
    const memory = await this.create(input);
    return { memory, isNew: true };
  },
  
  // Get memory by exact merchant+category+member combination
  async getByMerchantCategoryMember(
    merchantId: string,
    categoryId: string | null,
    memberId: string | null
  ): Promise<MerchantMemory | null> {
    const database = await openDatabase();
    
    let query = 'SELECT * FROM merchant_memory WHERE merchant_id = ?';
    const values: any[] = [merchantId];
    
    if (categoryId) {
      query += ' AND category_id = ?';
      values.push(categoryId);
    } else {
      query += ' AND category_id IS NULL';
    }
    
    if (memberId) {
      query += ' AND member_id = ?';
      values.push(memberId);
    } else {
      query += ' AND member_id IS NULL';
    }
    
    const row = await database.getFirstAsync(query, values);
    return row ? mapMerchantMemoryRow(row) : null;
  },
  
  // Get all memory entries for a merchant
  async getByMerchantId(merchantId: string): Promise<MerchantMemory[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      `SELECT * FROM merchant_memory 
       WHERE merchant_id = ? 
       ORDER BY usage_count DESC, last_used_at DESC`,
      [merchantId]
    );
    
    return rows.map(mapMerchantMemoryRow);
  },
  
  // Get best category suggestion for a merchant
  async getBestCategorySuggestion(merchantId: string): Promise<MerchantMemory | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      `SELECT * FROM merchant_memory 
       WHERE merchant_id = ? AND category_id IS NOT NULL
       ORDER BY 
         CASE source WHEN 'USER_CONFIRMED' THEN 3 WHEN 'SYSTEM_DEFAULT' THEN 2 ELSE 1 END DESC,
         CASE confidence WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
         usage_count DESC,
         last_used_at DESC
       LIMIT 1`,
      [merchantId]
    );
    
    return row ? mapMerchantMemoryRow(row) : null;
  },
  
  // Get best member suggestion for a merchant
  async getBestMemberSuggestion(merchantId: string): Promise<MerchantMemory | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      `SELECT * FROM merchant_memory 
       WHERE merchant_id = ? AND member_id IS NOT NULL
       ORDER BY 
         CASE source WHEN 'USER_CONFIRMED' THEN 3 WHEN 'SYSTEM_DEFAULT' THEN 2 ELSE 1 END DESC,
         CASE confidence WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
         usage_count DESC,
         last_used_at DESC
       LIMIT 1`,
      [merchantId]
    );
    
    return row ? mapMerchantMemoryRow(row) : null;
  },
  
  // Get combined best suggestion (category + member from best memory entry)
  async getBestSuggestion(merchantId: string): Promise<{
    categoryId: string | null;
    memberId: string | null;
    confidence: MerchantMemoryConfidence;
    source: MerchantMemorySource;
  } | null> {
    const database = await openDatabase();
    
    // Get the best overall memory entry for this merchant
    const row = await database.getFirstAsync(
      `SELECT * FROM merchant_memory 
       WHERE merchant_id = ? AND (category_id IS NOT NULL OR member_id IS NOT NULL)
       ORDER BY 
         CASE source WHEN 'USER_CONFIRMED' THEN 3 WHEN 'SYSTEM_DEFAULT' THEN 2 ELSE 1 END DESC,
         CASE confidence WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
         usage_count DESC,
         last_used_at DESC
       LIMIT 1`,
      [merchantId]
    );
    
    if (!row) return null;
    
    const memory = mapMerchantMemoryRow(row);
    return {
      categoryId: memory.categoryId,
      memberId: memory.memberId,
      confidence: memory.confidence,
      source: memory.source,
    };
  },
  
  // Update merchant memory
  async update(id: string, input: UpdateMerchantMemoryInput): Promise<MerchantMemory | null> {
    const database = await openDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (input.categoryId !== undefined) {
      updates.push('category_id = ?');
      values.push(input.categoryId);
    }
    if (input.memberId !== undefined) {
      updates.push('member_id = ?');
      values.push(input.memberId);
    }
    if (input.source !== undefined) {
      updates.push('source = ?');
      values.push(input.source);
    }
    if (input.confidence !== undefined) {
      updates.push('confidence = ?');
      values.push(input.confidence);
    }
    if (input.usageCount !== undefined) {
      updates.push('usage_count = ?');
      values.push(input.usageCount);
    }
    if (input.lastUsedAt !== undefined) {
      updates.push('last_used_at = ?');
      values.push(input.lastUsedAt);
    }
    
    if (updates.length === 0) {
      return this.getById(id);
    }
    
    updates.push('updatedAt = ?');
    values.push(now());
    values.push(id);
    
    await database.runAsync(
      `UPDATE merchant_memory SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getById(id);
  },
  
  // Get memory by ID
  async getById(id: string): Promise<MerchantMemory | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM merchant_memory WHERE id = ?',
      [id]
    );
    
    return row ? mapMerchantMemoryRow(row) : null;
  },
  
  // Increment usage count and update last_used_at
  async incrementUsage(id: string): Promise<void> {
    const database = await openDatabase();
    const timestamp = now();
    
    await database.runAsync(
      `UPDATE merchant_memory 
       SET usage_count = usage_count + 1, last_used_at = ?, updatedAt = ?
       WHERE id = ?`,
      [timestamp, timestamp, id]
    );
  },
  
  // Delete merchant memory
  async delete(id: string): Promise<boolean> {
    const database = await openDatabase();
    const result = await database.runAsync(
      'DELETE FROM merchant_memory WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  },
  
  // List with filters
  async list(filters: MerchantMemoryFilters = {}): Promise<MerchantMemory[]> {
    const database = await openDatabase();
    
    const conditions: string[] = [];
    const values: any[] = [];
    
    if (filters.merchantId) {
      conditions.push('merchant_id = ?');
      values.push(filters.merchantId);
    }
    if (filters.categoryId) {
      conditions.push('category_id = ?');
      values.push(filters.categoryId);
    }
    if (filters.memberId) {
      conditions.push('member_id = ?');
      values.push(filters.memberId);
    }
    if (filters.source) {
      conditions.push('source = ?');
      values.push(filters.source);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await database.getAllAsync(
      `SELECT * FROM merchant_memory ${whereClause} ORDER BY usage_count DESC, last_used_at DESC`,
      values
    );
    
    return rows.map(mapMerchantMemoryRow);
  },
  
  // Get memory stats for a merchant
  async getStats(merchantId: string): Promise<{
    totalEntries: number;
    userConfirmed: number;
    systemDefault: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  }> {
    const database = await openDatabase();
    
    const row = await database.getFirstAsync<{
      total: number;
      userConfirmed: number;
      systemDefault: number;
      high: number;
      medium: number;
      low: number;
    }>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN source = 'USER_CONFIRMED' THEN 1 ELSE 0 END) as userConfirmed,
        SUM(CASE WHEN source = 'SYSTEM_DEFAULT' THEN 1 ELSE 0 END) as systemDefault,
        SUM(CASE WHEN confidence = 'HIGH' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN confidence = 'MEDIUM' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN confidence = 'LOW' THEN 1 ELSE 0 END) as low
       FROM merchant_memory 
       WHERE merchant_id = ?`,
      [merchantId]
    );
    
    return {
      totalEntries: row?.total || 0,
      userConfirmed: row?.userConfirmed || 0,
      systemDefault: row?.systemDefault || 0,
      highConfidence: row?.high || 0,
      mediumConfidence: row?.medium || 0,
      lowConfidence: row?.low || 0,
    };
  },
};