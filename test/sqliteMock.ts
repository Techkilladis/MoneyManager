// In-memory stand-in for expo-sqlite backed by sql.js (real SQLite compiled
// to JS), so services run their actual SQL in tests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require('sql.js/dist/sql-asm.js') as (config?: object) => Promise<{ Database: new () => SqlJsDatabase }>;

interface SqlJsStatement {
  bind(params: unknown[]): void;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}

interface SqlJsDatabase {
  exec(sql: string): unknown;
  run(sql: string, params?: unknown[]): void;
  prepare(sql: string): SqlJsStatement;
  getRowsModified(): number;
  close(): void;
}

type Param = string | number | null | boolean | undefined;

function normalize(params: Param[] | Param | undefined, rest: Param[]): (string | number | null)[] {
  const list = Array.isArray(params) ? params : params === undefined ? rest : [params, ...rest];
  return list.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

class MockDatabase {
  constructor(private db: SqlJsDatabase) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params?: Param[] | Param, ...rest: Param[]) {
    this.db.run(sql, normalize(params, rest));
    const id = this.first('SELECT last_insert_rowid() AS id', []);
    return { changes: this.db.getRowsModified(), lastInsertRowId: Number(id?.id ?? 0) };
  }

  private first(sql: string, params: (string | number | null)[]): Record<string, unknown> | null {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      return stmt.step() ? stmt.getAsObject() : null;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T>(sql: string, params?: Param[] | Param, ...rest: Param[]): Promise<T | null> {
    return this.first(sql, normalize(params, rest)) as T | null;
  }

  async getAllAsync<T>(sql: string, params?: Param[] | Param, ...rest: Param[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const rows: T[] = [];
    try {
      stmt.bind(normalize(params, rest));
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
    } finally {
      stmt.free();
    }
    return rows;
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

function loadSqlJs() {
  // The asm.js build runs anywhere Jest does (the WASM builds don't under
  // jest-expo); it prints a deprecation notice we don't need to see.
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    return initSqlJs();
  } finally {
    console.warn = warn;
  }
}

export async function openDatabaseAsync(): Promise<MockDatabase> {
  sqlPromise ??= loadSqlJs();
  const SQL = await sqlPromise;
  return new MockDatabase(new SQL.Database());
}

export type SQLiteDatabase = MockDatabase;
