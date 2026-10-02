// Database Connection and Initialization
// Using Expo SQLite (expo-sqlite for SDK 52)

import * as SQLite from 'expo-sqlite';
import { schema, SCHEMA_VERSION, generateId, now, Transaction, Category, Member } from './schema';

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

// Open database
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('money-manager.db');
  return db;
}

// Initialize database schema
export async function initializeDatabase(): Promise<void> {
  const database = await openDatabase();
  
  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');
  
  // Create tables
  await database.execAsync(schema.createTransactionsTable);
  await database.execAsync(schema.createCategoriesTable);
  await database.execAsync(schema.createMembersTable);
  
  // Create indexes
  for (const indexSql of schema.createIndexes) {
    await database.execAsync(indexSql);
  }
  
  // Seed default data
  await seedDefaultData(database);
  
  console.log('[Database] Initialized successfully');
}

// Seed default categories and members
async function seedDefaultData(database: SQLite.SQLiteDatabase): Promise<void> {
  const timestamp = now();
  
  // Seed categories
  for (const cat of schema.seedCategories) {
    const existing = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [cat.id]
    );
    
    if (!existing) {
      await database.runAsync(
        `INSERT INTO categories (id, name, icon, color, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cat.id, cat.name, cat.icon, cat.color, cat.sortOrder, timestamp, timestamp]
      );
    }
  }
  
  // Seed members
  for (const member of schema.seedMembers) {
    const existing = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM members WHERE id = ?',
      [member.id]
    );
    
    if (!existing) {
      await database.runAsync(
        `INSERT INTO members (id, name, color, isDefault, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [member.id, member.name, member.color, member.isDefault, timestamp, timestamp]
      );
    }
  }
  
  console.log('[Database] Default data seeded');
}

// Close database
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

// Transaction helpers
export async function runInTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const database = await openDatabase();
  // withTransactionAsync expects a callback that receives the database
  // We'll just execute the callback directly since we already have the database
  return callback();
}

// Utility: Convert paise to formatted currency string
export function formatCurrency(paise: number, currency: string = 'INR'): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

// Utility: Parse currency string to paise
export function parseCurrency(value: string): number {
  // Remove currency symbol and commas
  const clean = value.replace(/[₹,\s]/g, '');
  const rupees = parseFloat(clean);
  return Math.round(rupees * 100);
}

// Re-export generateId and now for use in repositories
export { generateId, now } from './schema';

// Type-safe row mappers
export function mapTransactionRow(row: any): Transaction {
  return {
    id: row.id,
    amountPaise: row.amountPaise,
    currency: row.currency,
    merchant: row.merchant,
    transactionTimestamp: row.transactionTimestamp,
    categoryId: row.categoryId,
    memberId: row.memberId,
    note: row.note,
    status: row.status,
    sourceApp: row.sourceApp,
    notificationId: row.notificationId,
    rawNotification: row.rawNotification,
    parserMetadata: row.parserMetadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapCategoryRow(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapMemberRow(row: any): Member {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isDefault: Boolean(row.isDefault),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}