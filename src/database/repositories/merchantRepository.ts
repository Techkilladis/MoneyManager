// Merchant Repository
import { openDatabase, mapMerchantRow, generateId, now } from '../db';
import { Merchant } from '../schema';

export interface CreateMerchantInput {
  canonicalName: string;
  normalizedKey: string;
}

export const merchantRepository = {
  // Create a new merchant
  async create(input: CreateMerchantInput): Promise<Merchant> {
    const database = await openDatabase();
    const id = generateId();
    const timestamp = now();
    
    await database.runAsync(
      `INSERT INTO merchants (id, canonical_name, normalized_key, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.canonicalName, input.normalizedKey, timestamp, timestamp]
    );
    
    const row = await database.getFirstAsync(
      'SELECT * FROM merchants WHERE id = ?',
      [id]
    );
    
    return mapMerchantRow(row!);
  },
  
  // Get merchant by ID
  async getById(id: string): Promise<Merchant | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM merchants WHERE id = ?',
      [id]
    );
    
    return row ? mapMerchantRow(row) : null;
  },
  
  // Get merchant by normalized key
  async getByNormalizedKey(normalizedKey: string): Promise<Merchant | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM merchants WHERE normalized_key = ?',
      [normalizedKey]
    );
    
    return row ? mapMerchantRow(row) : null;
  },
  
  // Get or create merchant by normalized key (idempotent)
  async getOrCreateByNormalizedKey(normalizedKey: string, canonicalName: string): Promise<Merchant> {
    const existing = await this.getByNormalizedKey(normalizedKey);
    if (existing) {
      // Update canonical name if the new one is better (longer/more descriptive)
      if (canonicalName.length > existing.canonicalName.length) {
        await this.update(existing.id, { canonicalName });
        return { ...existing, canonicalName };
      }
      return existing;
    }
    
    return this.create({ canonicalName, normalizedKey });
  },
  
  // Update merchant
  async update(id: string, input: Partial<CreateMerchantInput>): Promise<Merchant | null> {
    const database = await openDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (input.canonicalName !== undefined) {
      updates.push('canonical_name = ?');
      values.push(input.canonicalName);
    }
    if (input.normalizedKey !== undefined) {
      updates.push('normalized_key = ?');
      values.push(input.normalizedKey);
    }
    
    if (updates.length === 0) {
      return this.getById(id);
    }
    
    updates.push('updatedAt = ?');
    values.push(now());
    values.push(id);
    
    await database.runAsync(
      `UPDATE merchants SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getById(id);
  },
  
  // List all merchants
  async getAll(): Promise<Merchant[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      'SELECT * FROM merchants ORDER BY canonical_name ASC'
    );
    
    return rows.map(mapMerchantRow);
  },
  
  // Search merchants by canonical name
  async search(query: string, limit: number = 20): Promise<Merchant[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      `SELECT * FROM merchants 
       WHERE canonical_name LIKE ? 
       ORDER BY canonical_name ASC 
       LIMIT ?`,
      [`%${query}%`, limit]
    );
    
    return rows.map(mapMerchantRow);
  },
};