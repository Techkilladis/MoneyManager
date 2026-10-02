// Database Types and Schema Definitions

export interface Transaction {
  id: string;
  amountPaise: number;
  currency: string;
  merchant: string;
  transactionTimestamp: number; // Unix timestamp in milliseconds
  categoryId: string | null;
  memberId: string | null;
  note: string | null;
  status: TransactionStatus;
  sourceApp: string | null;
  notificationId: string | null; // For deduplication
  rawNotification: string | null; // For debugging
  parserMetadata: string | null; // JSON string
  createdAt: number;
  updatedAt: number;
}

export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'EDITED' | 'CANCELLED';

export interface Category {
  id: string;
  name: string;
  icon: string | null; // SF Symbol name or custom identifier
  color: string | null; // Hex color
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface Member {
  id: string;
  name: string;
  color: string | null; // Hex color for UI
  isDefault: boolean; // System members vs custom
  createdAt: number;
  updatedAt: number;
}

// Database Schema Version
export const SCHEMA_VERSION = 1;

// SQL Statements
export const schema = {
  createTransactionsTable: `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amountPaise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      merchant TEXT NOT NULL,
      transactionTimestamp INTEGER NOT NULL,
      categoryId TEXT,
      memberId TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      sourceApp TEXT,
      notificationId TEXT,
      rawNotification TEXT,
      parserMetadata TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `,
  
  createCategoriesTable: `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      color TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `,
  
  createMembersTable: `
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      isDefault INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `,
  
  // Indexes for performance
  createIndexes: [
    'CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(transactionTimestamp DESC);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(categoryId);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(memberId);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_notification ON transactions(notificationId);',
    'CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sortOrder);',
  ],
  
  // Seed data
  seedCategories: [
    { id: 'cat-food', name: 'Food', icon: 'fork.knife', color: '#FF9500', sortOrder: 1 },
    { id: 'cat-travel', name: 'Travel', icon: 'car.fill', color: '#007AFF', sortOrder: 2 },
    { id: 'cat-shopping', name: 'Shopping', icon: 'bag.fill', color: '#AF52DE', sortOrder: 3 },
    { id: 'cat-bills', name: 'Bills', icon: 'doc.text.fill', color: '#FF3B30', sortOrder: 4 },
    { id: 'cat-entertainment', name: 'Entertainment', icon: 'tv.fill', color: '#FF2D92', sortOrder: 5 },
    { id: 'cat-health', name: 'Health', icon: 'cross.case.fill', color: '#34C759', sortOrder: 6 },
    { id: 'cat-education', name: 'Education', icon: 'book.fill', color: '#5856D6', sortOrder: 7 },
    { id: 'cat-subscriptions', name: 'Subscriptions', icon: 'repeat', color: '#00C7BE', sortOrder: 8 },
    { id: 'cat-family', name: 'Family', icon: 'person.2.fill', color: '#FF9F0A', sortOrder: 9 },
    { id: 'cat-personal', name: 'Personal', icon: 'person.fill', color: '#8E8E93', sortOrder: 10 },
    { id: 'cat-misc', name: 'Miscellaneous', icon: 'square.grid.2x2', color: '#C7C7CC', sortOrder: 11 },
  ],
  
  seedMembers: [
    { id: 'member-self', name: 'Self', color: '#007AFF', isDefault: 1 },
    { id: 'member-dad', name: 'Dad', color: '#34C759', isDefault: 1 },
    { id: 'member-mom', name: 'Mom', color: '#FF2D92', isDefault: 1 },
    { id: 'member-brother', name: 'Brother', color: '#FF9500', isDefault: 1 },
    { id: 'member-friend', name: 'Friend', color: '#AF52DE', isDefault: 1 },
  ],
} as const;

// Helper to generate UUID v4
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Current timestamp in milliseconds
export function now(): number {
  return Date.now();
}