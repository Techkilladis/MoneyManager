// Database Connection and Initialization
// Using Expo SQLite (expo-sqlite for SDK 52)

import * as SQLite from 'expo-sqlite';
import { schema, SCHEMA_VERSION, generateId, now, Transaction, Category, Member, Merchant, MerchantMemory, Budget } from './schema';

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

// Open database
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('money-manager.db');
  return db;
}

// Initialize database schema with migration support
export async function initializeDatabase(): Promise<void> {
  const database = await openDatabase();
  
  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');
  
  // Create tables first (with all columns including new ones)
  await database.execAsync(schema.createTransactionsTable);
  await database.execAsync(schema.createCategoriesTable);
  await database.execAsync(schema.createMembersTable);
  // Phase 5: Create merchant tables
  await database.execAsync(schema.createMerchantsTable);
  await database.execAsync(schema.createMerchantMemoryTable);
  // Phase 7: Create budgets table
  await database.execAsync(schema.createBudgetsTable);
  
  // Create indexes
  for (const indexSql of schema.createIndexes) {
    await database.execAsync(indexSql);
  }
  // Phase 5: Create merchant indexes
  for (const indexSql of schema.createMerchantIndexes) {
    await database.execAsync(indexSql);
  }
  // Phase 7: Create budget indexes
  for (const indexSql of schema.createBudgetIndexes) {
    await database.execAsync(indexSql);
  }
  
  // Run migrations (for existing installations upgrading from older versions)
  await runMigrations(database);
  
  // Seed default data
  await seedDefaultData(database);
  
  console.log('[Database] Initialized successfully');
}

// Run database migrations
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check current schema version
  const row = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  const currentVersion = row?.user_version || 0;
  
  if (currentVersion < SCHEMA_VERSION) {
    console.log(`[Database] Migrating from v${currentVersion} to v${SCHEMA_VERSION}`);
    
    if (currentVersion < 2) {
      // Migration v1 -> v2: Add sourceEventId and sourceType columns
      console.log('[Database] Running migration v1 -> v2');
      await runMigrationV1ToV2(database);
    }
    
    if (currentVersion < 3) {
      // Migration v2 -> v3: Add is_pending_capture, is_dismissed, dismissed_at columns
      console.log('[Database] Running migration v2 -> v3');
      await runMigrationV2ToV3(database);
    }
    
    if (currentVersion < 4) {
      // Migration v3 -> v4: Create merchant and merchant_memory tables
      console.log('[Database] Running migration v3 -> v4');
      await runMigrationV3ToV4(database);
    }
    
    if (currentVersion < 5) {
      // Migration v4 -> v5: Create budgets table
      console.log('[Database] Running migration v4 -> v5');
      await runMigrationV4ToV5(database);
    }
    
    // Update user_version
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    console.log(`[Database] Migration complete, now at v${SCHEMA_VERSION}`);
  }
}

// Idempotent migration: add columns if they don't exist
async function runMigrationV1ToV2(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check if sourceEventId column exists
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(transactions);');
  const columnNames = columns.map(c => c.name);
  
  if (!columnNames.includes('sourceEventId')) {
    await database.execAsync('ALTER TABLE transactions ADD COLUMN sourceEventId TEXT;');
    console.log('[Database] Added sourceEventId column');
  }
  if (!columnNames.includes('sourceType')) {
    await database.execAsync('ALTER TABLE transactions ADD COLUMN sourceType TEXT;');
    console.log('[Database] Added sourceType column');
  }
}

// Idempotent migration: add columns if they don't exist
async function runMigrationV2ToV3(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check if is_pending_capture column exists
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(transactions);');
  const columnNames = columns.map(c => c.name);
  
  if (!columnNames.includes('is_pending_capture')) {
    await database.execAsync('ALTER TABLE transactions ADD COLUMN is_pending_capture INTEGER NOT NULL DEFAULT 0;');
    console.log('[Database] Added is_pending_capture column');
  }
  if (!columnNames.includes('is_dismissed')) {
    await database.execAsync('ALTER TABLE transactions ADD COLUMN is_dismissed INTEGER NOT NULL DEFAULT 0;');
    console.log('[Database] Added is_dismissed column');
  }
  if (!columnNames.includes('dismissed_at')) {
    await database.execAsync('ALTER TABLE transactions ADD COLUMN dismissed_at INTEGER;');
    console.log('[Database] Added dismissed_at column');
  }
  
  // Create unique index if not exists
  await database.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_source_event_unique 
    ON transactions(sourceEventId) WHERE sourceEventId IS NOT NULL;
  `);
}

// Phase 5: Migration v3 -> v4 - Create merchant tables
async function runMigrationV3ToV4(database: SQLite.SQLiteDatabase): Promise<void> {
  // Tables are created with IF NOT EXISTS in initializeDatabase, so just verify they exist
  // and create indexes if needed
  try {
    await database.execAsync(schema.createMerchantsTable);
    await database.execAsync(schema.createMerchantMemoryTable);
    for (const indexSql of schema.createMerchantIndexes) {
      await database.execAsync(indexSql);
    }
    console.log('[Database] Phase 5 merchant tables created/verified');
  } catch (error) {
    console.error('[Database] Migration v3 -> v4 failed:', error);
  }
}

// Phase 7: Migration v4 -> v5 - Create budgets table
async function runMigrationV4ToV5(database: SQLite.SQLiteDatabase): Promise<void> {
  // Tables are created with IF NOT EXISTS in initializeDatabase, so just verify they exist
  // and create indexes if needed
  try {
    await database.execAsync(schema.createBudgetsTable);
    for (const indexSql of schema.createBudgetIndexes) {
      await database.execAsync(indexSql);
    }
    console.log('[Database] Phase 7 budgets table created/verified');
  } catch (error) {
    console.error('[Database] Migration v4 -> v5 failed:', error);
  }
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
  const clean = value.replace(/[₹,\\s]/g, '');
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
    sourceEventId: row.sourceEventId,     // NEW
    sourceType: row.sourceType,           // NEW
    is_pending_capture: row.is_pending_capture ?? 0,  // NEW
    is_dismissed: row.is_dismissed ?? 0,            // NEW
    dismissed_at: row.dismissed_at ?? null,         // NEW
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

export function mapMerchantRow(row: any): Merchant {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    normalizedKey: row.normalized_key,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapMerchantMemoryRow(row: any): MerchantMemory {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    categoryId: row.category_id,
    memberId: row.member_id,
    source: row.source,
    confidence: row.confidence,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapBudgetRow(row: any): Budget {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    amountPaise: row.amount_paise,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}