// Category Repository
import { openDatabase, mapCategoryRow } from '../db';
import { Category, TransactionKind } from '../schema';

export interface CreateCategoryInput {
  name: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  kind?: TransactionKind;
}

export interface UpdateCategoryInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}

export const categoryRepository = {
  // Create a new category
  async create(input: CreateCategoryInput): Promise<Category> {
    const database = await openDatabase();
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = Date.now();
    
    await database.runAsync(
      `INSERT INTO categories (id, name, icon, color, sortOrder, kind, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.icon || null, input.color || null, input.sortOrder || 0, input.kind ?? 'EXPENSE', timestamp, timestamp]
    );
    
    const row = await database.getFirstAsync(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    
    return mapCategoryRow(row!);
  },
  
  // Get category by ID
  async getById(id: string): Promise<Category | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    
    return row ? mapCategoryRow(row) : null;
  },
  
  // Get category by name
  async getByName(name: string): Promise<Category | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM categories WHERE name = ?',
      [name]
    );
    
    return row ? mapCategoryRow(row) : null;
  },
  
  // Update category
  async update(id: string, input: UpdateCategoryInput): Promise<Category | null> {
    const database = await openDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.icon !== undefined) {
      updates.push('icon = ?');
      values.push(input.icon);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }
    if (input.sortOrder !== undefined) {
      updates.push('sortOrder = ?');
      values.push(input.sortOrder);
    }
    
    if (updates.length === 0) {
      return this.getById(id);
    }
    
    updates.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);
    
    await database.runAsync(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getById(id);
  },
  
  // Delete category (only if no transactions reference it)
  async delete(id: string): Promise<boolean> {
    const database = await openDatabase();
    
    // Check if any transactions use this category
    const txCount = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE categoryId = ?',
      [id]
    );
    
    if ((txCount?.count || 0) > 0) {
      throw new Error('Cannot delete category with existing transactions');
    }
    
    const result = await database.runAsync(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  },
  
  // List all categories
  async list(): Promise<Category[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      'SELECT * FROM categories ORDER BY sortOrder ASC, name ASC'
    );
    
    return rows.map(mapCategoryRow);
  },
  
  // Get all categories (alias for list)
  async getAll(): Promise<Category[]> {
    return this.list();
  },

  /**
   * Returns categories ranked by Category Freshiency:
   * 1. Rolling window confirmed transaction count DESC (default 90 days)
   * 2. Recency tie-breaker: most recent confirmed transaction timestamp in rolling window DESC
   * 3. All-time confirmed transaction count DESC
   * 4. All-time recency tie-breaker: most recent confirmed transaction timestamp DESC
   * 5. Catalog sortOrder ASC
   * 6. Category name ASC
   *
   * Only CONFIRMED, non-pending-capture, non-dismissed transactions are counted.
   * If kind is provided, filters strictly to categories of that kind.
   */
  async getRankedByUsage(
    kind?: TransactionKind,
    options?: { now?: number; windowDays?: number }
  ): Promise<Category[]> {
    const database = await openDatabase();
    const now = options?.now ?? Date.now();
    const windowDays = options?.windowDays ?? 90;
    const windowStart = now - windowDays * 24 * 60 * 60 * 1000;

    const query = `
      SELECT c.*
      FROM categories c
      LEFT JOIN transactions t ON t.categoryId = c.id
        AND t.kind = c.kind
        AND t.status = 'CONFIRMED'
        AND t.is_pending_capture = 0
        AND t.is_dismissed = 0
      ${kind ? 'WHERE c.kind = ?' : ''}
      GROUP BY c.id
      ORDER BY
        COUNT(CASE WHEN t.transactionTimestamp >= ? THEN 1 END) DESC,
        COALESCE(MAX(CASE WHEN t.transactionTimestamp >= ? THEN t.transactionTimestamp END), 0) DESC,
        COUNT(t.id) DESC,
        COALESCE(MAX(t.transactionTimestamp), 0) DESC,
        c.sortOrder ASC,
        c.name ASC
    `;

    const params = kind
      ? [kind, windowStart, windowStart]
      : [windowStart, windowStart];

    const rows = await database.getAllAsync(query, params);
    return rows.map(mapCategoryRow);
  },
};