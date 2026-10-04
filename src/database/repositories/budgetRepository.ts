// Budget Repository
import { openDatabase, mapBudgetRow, generateId, now, runInTransaction } from '../db';
import { Budget, BudgetPeriodType } from '../schema';

export interface CreateBudgetInput {
  name: string;
  categoryId: string;
  amountPaise: number;
  periodType: BudgetPeriodType;
  periodStart: number;
  periodEnd: number;
  isActive?: boolean;
}

export interface UpdateBudgetInput {
  name?: string;
  categoryId?: string;
  amountPaise?: number;
  periodType?: BudgetPeriodType;
  periodStart?: number;
  periodEnd?: number;
  isActive?: boolean;
}

export interface BudgetFilters {
  categoryId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export const budgetRepository = {
  // Create a new budget
  async create(input: CreateBudgetInput): Promise<Budget> {
    const database = await openDatabase();
    const id = generateId();
    const timestamp = now();
    
    await database.runAsync(
      `INSERT INTO budgets (
        id, name, category_id, amount_paise, period_type,
        period_start, period_end, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.categoryId,
        input.amountPaise,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        input.isActive !== false ? 1 : 0,
        timestamp,
        timestamp,
      ]
    );
    
    const row = await database.getFirstAsync(
      'SELECT * FROM budgets WHERE id = ?',
      [id]
    );
    
    return mapBudgetRow(row!);
  },
  
  // Get budget by ID
  async getById(id: string): Promise<Budget | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      'SELECT * FROM budgets WHERE id = ?',
      [id]
    );
    
    return row ? mapBudgetRow(row) : null;
  },
  
  // Get budget by category and period (for active budget lookups)
  async getByCategoryAndPeriod(categoryId: string, periodStart: number, periodEnd: number): Promise<Budget | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync(
      `SELECT * FROM budgets 
       WHERE category_id = ? 
       AND is_active = 1
       AND period_start = ?
       AND period_end = ?`,
      [categoryId, periodStart, periodEnd]
    );
    
    return row ? mapBudgetRow(row) : null;
  },
  
  // Update budget
  async update(id: string, input: UpdateBudgetInput): Promise<Budget | null> {
    const database = await openDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.categoryId !== undefined) {
      updates.push('category_id = ?');
      values.push(input.categoryId);
    }
    if (input.amountPaise !== undefined) {
      updates.push('amount_paise = ?');
      values.push(input.amountPaise);
    }
    if (input.periodType !== undefined) {
      updates.push('period_type = ?');
      values.push(input.periodType);
    }
    if (input.periodStart !== undefined) {
      updates.push('period_start = ?');
      values.push(input.periodStart);
    }
    if (input.periodEnd !== undefined) {
      updates.push('period_end = ?');
      values.push(input.periodEnd);
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(input.isActive ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return this.getById(id);
    }
    
    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);
    
    await database.runAsync(
      `UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getById(id);
  },
  
  // Delete budget (soft delete by setting is_active = 0)
  async delete(id: string): Promise<boolean> {
    const database = await openDatabase();
    const result = await database.runAsync(
      'UPDATE budgets SET is_active = 0, updated_at = ? WHERE id = ?',
      [now(), id]
    );
    
    return result.changes > 0;
  },
  
  // Hard delete (for testing/admin)
  async hardDelete(id: string): Promise<boolean> {
    const database = await openDatabase();
    const result = await database.runAsync(
      'DELETE FROM budgets WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  },
  
  // List budgets with filters
  async list(filters: BudgetFilters = {}): Promise<Budget[]> {
    const database = await openDatabase();
    
    const conditions: string[] = [];
    const values: any[] = [];
    
    if (filters.categoryId) {
      conditions.push('category_id = ?');
      values.push(filters.categoryId);
    }
    if (filters.isActive !== undefined) {
      conditions.push('is_active = ?');
      values.push(filters.isActive ? 1 : 0);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    const rows = await database.getAllAsync(
      `SELECT * FROM budgets ${whereClause} ORDER BY period_start DESC, name ASC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    
    return rows.map(mapBudgetRow);
  },
  
  // Get all active budgets
  async getActive(): Promise<Budget[]> {
    return this.list({ isActive: true });
  },
  
  // Get budgets for a specific period
  async getByPeriod(periodStart: number, periodEnd: number): Promise<Budget[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync(
      `SELECT * FROM budgets 
       WHERE is_active = 1
       AND period_start = ?
       AND period_end = ?
       ORDER BY name ASC`,
      [periodStart, periodEnd]
    );
    
    return rows.map(mapBudgetRow);
  },
};