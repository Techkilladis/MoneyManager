/**
 * Budget Service
 * 
 * Handles budget calculations, validation, and state determination.
 * All calculations use confirmed transactions only (status = CONFIRMED).
 */

import { budgetRepository } from '../database/repositories/budgetRepository';
import { transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { Budget, BudgetPeriodType, BudgetWithSpending, BudgetStatus } from '../database/schema';
import { now } from '../database/db';

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
  const transactions = await transactionRepository.list({
    categoryId,
    status: 'CONFIRMED',
    startDate: periodStart,
    endDate: periodEnd - 1, // periodEnd is exclusive
  });
  
  return transactions.reduce((sum, t) => sum + t.amountPaise, 0);
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