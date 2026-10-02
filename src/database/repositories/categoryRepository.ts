// Category Repository
import { openDatabase, mapCategoryRow } from '../db';
import { Category } from '../schema';

export interface CreateCategoryInput {
  name: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
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
      `INSERT INTO categories (id, name, icon, color, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.icon || null, input.color || null, input.sortOrder || 0, timestamp, timestamp]
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
};