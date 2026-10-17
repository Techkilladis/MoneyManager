/**
 * Budget Service
 * 
 * Handles budget calculations, validation, and state determination.
 * All calculations use confirmed transactions only (status = CONFIRMED).
 */

import { budgetRepository } from '../database/repositories/budgetRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { Budget, BudgetPeriodType, BudgetWithSpending, BudgetStatus, Category } from '../database/schema';
import { openDatabase } from '../database/db';

// Budget status thresholds (centralized, not magic numbers)
const BUDGET_THRESHOLDS = {
  HEALTHY_MAX: 75,    // < 75%
  WARNING_MAX: 99,    // 75-99%
  // >= 100% is EXCEEDED
} as const;

/**
 * Calculate budget status from percentage used
 */
export function calculateBudgetStatus(percentageUsed: number): BudgetStatus {
  if (percentageUsed < BUDGET_THRESHOLDS.HEALTHY_MAX) {
    return 'HEALTHY';
  } else if (percentageUsed < BUDGET_THRESHOLDS.WARNING_MAX) {
    return 'WARNING';
  } else {
    return 'EXCEEDED';
  }
}

/**
 * Get spending for a specific category within a period
 * ONLY uses CONFIRMED transactions
 */
async function getCategorySpendingInPeriod(
  categoryId: string,
  periodStart: number,
  periodEnd: number
): Promise<number> {
  // Aggregate in SQL: listing rows would be capped by the repository's
  // default page size and under-count busy categories.
  const database = await openDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amountPaise), 0) AS total FROM transactions
     WHERE status = 'CONFIRMED' AND is_pending_capture = 0 AND is_dismissed = 0
     AND categoryId = ? AND transactionTimestamp >= ? AND transactionTimestamp < ?`,
    [categoryId, periodStart, periodEnd]
  );
  return row?.total ?? 0;
}

export interface MonthlyBudgetView extends BudgetWithSpending {
  category: Category | null;
}

/**
 * Monthly budgets are recurring: an active MONTHLY budget applies to every
 * month, so spending is measured against the month containing `date`
 * rather than the period the budget was created in.
 */
export async function getMonthlyBudgets(date = new Date()): Promise<MonthlyBudgetView[]> {
  const { start, end } = getMonthlyPeriodBounds(date.getFullYear(), date.getMonth());
  const [budgets, categories] = await Promise.all([budgetRepository.getActive(), categoryRepository.getAll()]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const views = await Promise.all(
    budgets
      .filter((b) => b.periodType === 'MONTHLY')
      .map(async (budget) => {
        const spentPaise = await getCategorySpendingInPeriod(budget.categoryId, start, end);
        const raw = budget.amountPaise > 0 ? Math.round((spentPaise / budget.amountPaise) * 100) : 0;
        return {
          budget,
          category: categoryMap.get(budget.categoryId) ?? null,
          spentPaise,
          remainingPaise: budget.amountPaise - spentPaise,
          percentageUsed: raw,
          status: calculateBudgetStatus(raw),
        };
      })
  );

  return views.sort((a, b) => b.percentageUsed - a.percentageUsed);
}

/** Creates or updates the recurring monthly budget for a category. */
export async function upsertMonthlyBudget(
  categoryId: string,
  amountPaise: number
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return { success: false, error: 'Enter a budget amount greater than zero' };
  }
  const category = await categoryRepository.getById(categoryId);
  if (!category) return { success: false, error: 'Selected category does not exist' };

  const active = await budgetRepository.list({ categoryId, isActive: true });
  const existing = active.find((b) => b.periodType === 'MONTHLY');
  if (existing) {
    await budgetRepository.update(existing.id, { amountPaise, name: category.name });
    return { success: true };
  }

  const nowDate = new Date();
  const { start, end } = getMonthlyPeriodBounds(nowDate.getFullYear(), nowDate.getMonth());
  await budgetRepository.create({
    name: category.name,
    categoryId,
    amountPaise,
    periodType: 'MONTHLY',
    periodStart: start,
    periodEnd: end,
    isActive: true,
  });
  return { success: true };
}

/**
 * Get spending for all active budgets in a period
 */
export async function getBudgetSpending(periodStart: number, periodEnd: number): Promise<
  Array<{ budget: Budget; spentPaise: number }>
> {
  const budgets = await budgetRepository.getByPeriod(periodStart, periodEnd);
  
  const results = await Promise.all(
    budgets.map(async (budget) => {
      const spentPaise = await getCategorySpendingInPeriod(
        budget.categoryId,
        periodStart,
        periodEnd
      );
      return { budget, spentPaise };
    })
  );
  
  return results;
}

/**
 * Calculate budget with spending (BudgetWithSpending)
 * Returns null if budget not found
 */
export async function calculateBudgetWithSpending(
  budget: Budget
): Promise<BudgetWithSpending | null> {
  const spentPaise = await getCategorySpendingInPeriod(
    budget.categoryId,
    budget.periodStart,
    budget.periodEnd
  );
  
  const remainingPaise = budget.amountPaise - spentPaise;
  const percentageUsed = budget.amountPaise > 0 
    ? Math.round((spentPaise / budget.amountPaise) * 100)
    : 0;
  
  const status = calculateBudgetStatus(percentageUsed);
  
  return {
    budget,
    spentPaise,
    remainingPaise,
    percentageUsed: Math.min(percentageUsed, 100), // Cap at 100 for display
    status,
  };
}

/**
 * Get all budgets with spending for a period
 */
export async function getAllBudgetsWithSpending(periodStart: number, periodEnd: number): Promise<BudgetWithSpending[]> {
  const budgets = await budgetRepository.getByPeriod(periodStart, periodEnd);
  
  const results: BudgetWithSpending[] = [];
  
  for (const budget of budgets) {
    const calculated = await calculateBudgetWithSpending(budget);
    if (calculated) {
      results.push(calculated);
    }
  }
  
  return results;
}

/**
 * Create a new budget with validation
 */
export async function createBudget(input: {
  name: string;
  categoryId: string;
  amountPaise: number;
  periodType: BudgetPeriodType;
  periodStart: number;
  periodEnd: number;
}): Promise<{ success: boolean; budget?: Budget; error?: string }> {
  // Validation
  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: 'Budget name is required' };
  }
  
  if (input.amountPaise <= 0) {
    return { success: false, error: 'Budget amount must be greater than zero' };
  }
  
  if (!input.categoryId) {
    return { success: false, error: 'Category is required' };
  }
  
  if (input.periodStart >= input.periodEnd) {
    return { success: false, error: 'Period start must be before period end' };
  }
  
  // Check if category exists
  const category = await categoryRepository.getById(input.categoryId);
  if (!category) {
    return { success: false, error: 'Selected category does not exist' };
  }
  
  // Check for existing active budget for same category and period
  const existing = await budgetRepository.getByCategoryAndPeriod(
    input.categoryId,
    input.periodStart,
    input.periodEnd
  );
  
  if (existing) {
    return { success: false, error: 'An active budget already exists for this category and period' };
  }
  
  const budget = await budgetRepository.create({
    name: input.name.trim(),
    categoryId: input.categoryId,
    amountPaise: input.amountPaise,
    periodType: input.periodType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    isActive: true,
  });
  
  return { success: true, budget };
}

/**
 * Update budget with validation
 */
export async function updateBudget(
  id: string,
  input: {
    name?: string;
    amountPaise?: number;
    isActive?: boolean;
  }
): Promise<{ success: boolean; budget?: Budget; error?: string }> {
  const existing = await budgetRepository.getById(id);
  if (!existing) {
    return { success: false, error: 'Budget not found' };
  }
  
  if (input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: 'Budget name cannot be empty' };
    }
  }
  
  if (input.amountPaise !== undefined && input.amountPaise <= 0) {
    return { success: false, error: 'Budget amount must be greater than zero' };
  }
  
  const budget = await budgetRepository.update(id, {
    name: input.name?.trim(),
    amountPaise: input.amountPaise,
    isActive: input.isActive,
  });
  
  if (!budget) {
    return { success: false, error: 'Failed to update budget' };
  }
  
  return { success: true, budget };
}

/**
 * Delete (disable) a budget
 */
export async function deleteBudget(id: string): Promise<{ success: boolean; error?: string }> {
  const existing = await budgetRepository.getById(id);
  if (!existing) {
    return { success: false, error: 'Budget not found' };
  }
  
  const deleted = await budgetRepository.delete(id);
  return { success: deleted, error: deleted ? undefined : 'Failed to delete budget' };
}

/**
 * Get monthly period boundaries (inclusive start, exclusive end)
 * Uses local timezone
 */
export function getMonthlyPeriodBounds(year: number, month: number): { start: number; end: number } {
  const start = new Date(year, month, 1, 0, 0, 0, 0).getTime();
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0).getTime();
  return { start, end };
}

/**
 * Get current month period bounds
 */
export function getCurrentMonthPeriod(): { start: number; end: number } {
  const nowDate = new Date();
  return getMonthlyPeriodBounds(nowDate.getFullYear(), nowDate.getMonth());
}

/**
 * Get previous month period bounds
 */
export function getPreviousMonthPeriod(): { start: number; end: number } {
  const nowDate = new Date();
  const year = nowDate.getMonth() === 0 ? nowDate.getFullYear() - 1 : nowDate.getFullYear();
  const month = nowDate.getMonth() === 0 ? 11 : nowDate.getMonth() - 1;
  return getMonthlyPeriodBounds(year, month);
}

/**
 * Get weekly period bounds (Monday start)
 */
export function getWeeklyPeriodBounds(date: Date): { start: number; end: number } {
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  
  const startDate = new Date(date);
  startDate.setDate(date.getDate() + diff);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 7);
  
  return { start: startDate.getTime(), end: endDate.getTime() };
}

/**
 * Get current week period bounds
 */
export function getCurrentWeekPeriod(): { start: number; end: number } {
  return getWeeklyPeriodBounds(new Date());
}