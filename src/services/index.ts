// Services - Business logic layer connecting repositories to UI

import { transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { formatCurrency, formatDate, formatRelativeDate, FormattedTransaction, HomeData } from '../domain/transaction';
import { initializeDatabase } from '../database/db';
import { seedDevelopmentData } from './seedData';

export const transactionService = {
  // Initialize database
  async initialize(): Promise<void> {
    await initializeDatabase();
    await seedDevelopmentData();
  },
  
  // Get home screen data
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
      transactionRepository.count({ status: 'PENDING' }),
    ]);
    
    return {
      totalSpending,
      totalSpendingFormatted: formatCurrency(totalSpending),
      pendingCount,
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
      category: null, // Will be populated by caller if needed
      member: null,
      note: tx.note,
      status: tx.status,
      sourceApp: tx.sourceApp,
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
      };
    });
  },
  
  // Create transaction
  async createTransaction(input: any) {
    return transactionRepository.create(input);
  },
  
  // Update transaction
  async updateTransaction(id: string, input: any) {
    return transactionRepository.update(id, input);
  },
  
  // Delete transaction
  async deleteTransaction(id: string) {
    return transactionRepository.delete(id);
  },
  
  // Confirm pending transaction
  async confirmTransaction(id: string, categoryId?: string, memberId?: string) {
    return transactionRepository.update(id, {
      status: 'CONFIRMED',
      categoryId: categoryId || undefined,
      memberId: memberId || undefined,
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

// Export all services
export const services = {
  transaction: transactionService,
  category: categoryService,
  member: memberService,
};