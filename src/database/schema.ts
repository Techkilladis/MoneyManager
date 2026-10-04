// Database Schema Definitions - Phase 4 Updated
// Added sourceEventId and sourceType for idempotency
// Phase 4.1: Added is_pending_capture, is_dismissed, dismissed_at for proper pending/dismissal semantics

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
  notificationId: string | null; // For deduplication (legacy)
  rawNotification: string | null; // For debugging
  parserMetadata: string | null; // JSON string
  sourceEventId: string | null; // NEW: Native pending event ID for idempotency
  sourceType: SourceType | null; // NEW: Event source type
  is_pending_capture: number; // 1 = captured UPI event awaiting review, 0 = regular transaction
  is_dismissed: number; // 1 = dismissed (rejected/ignored), 0 = active
  dismissed_at: number | null; // Timestamp when dismissed
  createdAt: number;
  updatedAt: number;
}

export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'EDITED' | 'CANCELLED';

export type SourceType = 'UPI_NOTIFICATION' | 'MANUAL' | 'SEED_DATA';

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

// Phase 5: Merchant and Merchant Memory
export interface Merchant {
  id: string;
  canonicalName: string;
  normalizedKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface MerchantMemory {
  id: string;
  merchantId: string;
  categoryId: string | null;
  memberId: string | null;
  source: 'USER_CONFIRMED' | 'SYSTEM_DEFAULT' | 'AI_SUGGESTED';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  usageCount: number;
  lastUsedAt: number;
  createdAt: number;
  updatedAt: number;
}

export type MerchantMemorySource = 'USER_CONFIRMED' | 'SYSTEM_DEFAULT' | 'AI_SUGGESTED';
export type MerchantMemoryConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

// Database Schema Version - INCREMENTED FOR PHASE 5
export const SCHEMA_VERSION = 4;

// SQL Statements
export const schema = {
  // Phase 4.1: Added is_pending_capture, is_dismissed, dismissed_at columns
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
      sourceEventId TEXT,      -- Native pending event ID
      sourceType TEXT,         -- Event source type
      is_pending_capture INTEGER NOT NULL DEFAULT 0, -- 1 = captured UPI event awaiting review
      is_dismissed INTEGER NOT NULL DEFAULT 0,       -- 1 = dismissed (rejected/ignored)
      dismissed_at INTEGER,                           -- Timestamp when dismissed
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

  // Migration from v1 to v2 - add sourceEventId and sourceType columns
  // Idempotent: only adds columns if they don't exist
  migrateV1ToV2: `
    -- Use a temporary table approach for idempotent column addition
    -- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we check via PRAGMA
  `,

  // Migration from v2 to v3 - add is_pending_capture, is_dismissed, dismissed_at columns
  // Idempotent: only adds columns if they don't exist
  migrateV2ToV3: `
    -- Use a temporary table approach for idempotent column addition
    -- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we check via PRAGMA
  `,

  // Indexes for performance
  createIndexes: [
    'CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(transactionTimestamp DESC);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(categoryId);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(memberId);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_notification ON transactions(notificationId);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_source_event ON transactions(sourceEventId);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_source_type ON transactions(sourceType);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_pending_capture ON transactions(is_pending_capture);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_dismissed ON transactions(is_dismissed);',
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

  // Phase 5: Merchant tables
  createMerchantsTable: `
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      normalized_key TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `,

  createMerchantMemoryTable: `
    CREATE TABLE IF NOT EXISTS merchant_memory (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      category_id TEXT,
      member_id TEXT,
      source TEXT NOT NULL CHECK (source IN ('USER_CONFIRMED', 'SYSTEM_DEFAULT', 'AI_SUGGESTED')),
      confidence TEXT NOT NULL CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
      usage_count INTEGER NOT NULL DEFAULT 1,
      last_used_at INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
    );
  `,

  createMerchantIndexes: [
    'CREATE INDEX IF NOT EXISTS idx_merchants_normalized_key ON merchants(normalized_key);',
    'CREATE INDEX IF NOT EXISTS idx_merchant_memory_merchant ON merchant_memory(merchant_id);',
    'CREATE INDEX IF NOT EXISTS idx_merchant_memory_category ON merchant_memory(category_id);',
    'CREATE INDEX IF NOT EXISTS idx_merchant_memory_member ON merchant_memory(member_id);',
    'CREATE INDEX IF NOT EXISTS idx_merchant_memory_source ON merchant_memory(source);',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_memory_unique ON merchant_memory(merchant_id, category_id, member_id);',
  ],

  // Migration from v3 to v4 - add merchant and merchant_memory tables
  migrateV3ToV4: `
    -- Migration v3 -> v4: Create merchant and merchant_memory tables
    -- Tables are created with IF NOT EXISTS, so this is idempotent for fresh installs
  `,
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