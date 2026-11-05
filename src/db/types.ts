// The small part of expo-sqlite's SQLiteDatabase that this app uses. Writing the queries against this, and not the
// class itself, lets the tests run the same queries on Node's own SQLite (tests/node-db.ts).

export type Param = string | number | null;

export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: Param[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(source: string, params: Param[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: Param[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
