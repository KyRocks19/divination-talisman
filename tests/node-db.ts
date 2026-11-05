/// <reference types="node" />
// The `Db` interface (src/db/types.ts) on Node's own SQLite, so the tests run the app's real queries and migrations.

import { DatabaseSync } from "node:sqlite";
import type { Db, Param } from "../src/db/types";

export function memoryDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  return {
    raw,
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params: Param[]) {
      const r = raw.prepare(source).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(source: string, params: Param[]) {
      return raw.prepare(source).all(...params).map((row: object) => ({ ...row })) as T[];
    },
    async getFirstAsync<T>(source: string, params: Param[]) {
      const row = raw.prepare(source).get(...params);
      return row ? ({ ...row } as T) : null;
    },
    async withTransactionAsync(task) {
      raw.exec("BEGIN");
      try {
        await task();
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
