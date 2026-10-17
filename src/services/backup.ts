/**
 * Backup and restore. A backup is one JSON file with every table, written to
 * the cache directory and handed to the share sheet (Drive, Files, email...).
 * Restoring replaces all data, inside one database transaction.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { openDatabase } from '../database/db';
import { SCHEMA_VERSION } from '../database/schema';
import { resetSettingsCache, setSetting } from './settings';
import { exportTransactionsCsv } from './ledger';

// Insert order respects foreign keys (parents first).
const TABLES = [
  'categories',
  'members',
  'merchants',
  'merchant_memory',
  'budgets',
  'transactions',
  'splits',
  'recurring_payments',
  'app_settings',
] as const;

// Device-specific settings that shouldn't travel to another phone.
const LOCAL_SETTINGS = new Set(['appLockEnabled', 'appLockTimeoutMs', 'onboardingDone', 'budgetAlertsSent']);

type Row = Record<string, string | number | null>;

export interface BackupFile {
  app: 'money-manager';
  format: 1;
  schemaVersion: number;
  exportedAt: number;
  tables: Partial<Record<(typeof TABLES)[number], Row[]>>;
}

export interface BackupSummary {
  exportedAt: number;
  transactions: number;
  categories: number;
  budgets: number;
  recurring: number;
}

export function summarize(file: BackupFile): BackupSummary {
  return {
    exportedAt: file.exportedAt,
    transactions: file.tables.transactions?.length ?? 0,
    categories: file.tables.categories?.length ?? 0,
    budgets: file.tables.budgets?.length ?? 0,
    recurring: file.tables.recurring_payments?.length ?? 0,
  };
}

export async function createBackup(): Promise<BackupFile> {
  const db = await openDatabase();
  const tables: BackupFile['tables'] = {};
  for (const table of TABLES) {
    let rows = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
    if (table === 'app_settings') rows = rows.filter((r) => !LOCAL_SETTINGS.has(String(r.key)));
    tables[table] = rows;
  }
  return { app: 'money-manager', format: 1, schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), tables };
}

function stamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

async function shareFile(name: string, contents: string, mimeType: string, title: string): Promise<boolean> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('Storage is not available');
  const uri = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(uri, contents, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json' });
  return true;
}

/** Writes a backup and opens the share sheet. Returns what was saved. */
export async function exportBackup(): Promise<BackupSummary> {
  const file = await createBackup();
  await shareFile(`money-manager-backup-${stamp()}.json`, JSON.stringify(file), 'application/json', 'Save your backup');
  await setSetting('lastBackupAt', file.exportedAt);
  return summarize(file);
}

export async function exportCsvFile(): Promise<number> {
  const { csv, count } = await exportTransactionsCsv();
  if (count === 0) return 0;
  await shareFile(`money-manager-transactions-${stamp()}.csv`, csv, 'text/csv', 'Export transactions');
  return count;
}

export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a Money Manager backup");
  }
  const file = json as Partial<BackupFile>;
  if (!file || file.app !== 'money-manager' || file.format !== 1 || typeof file.tables !== 'object' || !file.tables) {
    throw new Error("This file isn't a Money Manager backup");
  }
  if (typeof file.schemaVersion === 'number' && file.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup is from a newer version of the app. Update the app and try again.');
  }
  for (const [table, rows] of Object.entries(file.tables)) {
    if (!(TABLES as readonly string[]).includes(table) || !Array.isArray(rows)) {
      throw new Error('The backup file is damaged');
    }
  }
  return file as BackupFile;
}

/** Lets the user pick a backup file. Returns null if they cancel. */
export async function pickBackup(): Promise<BackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  return parseBackup(text);
}

/** Replaces all app data with the backup's. Columns unknown to this version are ignored. */
export async function restoreBackup(file: BackupFile): Promise<BackupSummary> {
  const db = await openDatabase();
  const columns = new Map<string, Set<string>>();
  for (const table of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    columns.set(table, new Set(info.map((c) => c.name)));
  }

  // FK checks are off during the swap: rows reference each other across tables.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const table of [...TABLES].reverse()) {
        if (table === 'app_settings') {
          const keep = [...LOCAL_SETTINGS].map(() => '?').join(',');
          await db.runAsync(`DELETE FROM app_settings WHERE key NOT IN (${keep})`, [...LOCAL_SETTINGS]);
        } else {
          await db.execAsync(`DELETE FROM ${table};`);
        }
      }
      for (const table of TABLES) {
        const known = columns.get(table)!;
        for (const row of file.tables[table] ?? []) {
          if (table === 'app_settings' && LOCAL_SETTINGS.has(String(row.key))) continue;
          const cols = Object.keys(row).filter((c) => known.has(c));
          if (cols.length === 0) continue;
          await db.runAsync(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map((c) => row[c] ?? null)
          );
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  resetSettingsCache();
  return summarize(file);
}
