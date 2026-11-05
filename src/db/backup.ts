// Backup and restore: the whole database as one JSON file the person saves wherever they like (Files, iCloud Drive,
// Google Drive, an email to themselves). It is the only copy outside the phone, so it must round-trip exactly.

import { MIGRATIONS, TABLES, type TableName } from "./schema";
import type { Db, Param } from "./types";

export const PHONE_BACKUP_FORMAT = "divination-talisman-backup-1";

export interface PhoneBackup {
  format: typeof PHONE_BACKUP_FORMAT;
  created: string;
  /** How many migrations the database that made this file had run. */
  schema: number;
  tables: Record<TableName, Record<string, Param>[]>;
}

/** divination-talisman-2026-11-05-0930.json, in the phone's own time. */
export function backupFileName(when: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `divination-talisman-${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}.json`;
}

export async function makeBackup(db: Db, when = new Date()): Promise<PhoneBackup> {
  const tables = {} as PhoneBackup["tables"];
  for (const t of TABLES) tables[t] = await db.getAllAsync<Record<string, Param>>(`SELECT * FROM ${t}`, []);
  return { format: PHONE_BACKUP_FORMAT, created: when.toISOString(), schema: MIGRATIONS.length, tables };
}

export type CheckedBackup = { ok: true; backup: PhoneBackup; rows: number } | { ok: false; error: string };

/** Reads a backup file's text and says, in plain words, why it cannot be used when it cannot. Nothing is written. */
export function checkBackup(text: string): CheckedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not a backup from this app (it could not be read as JSON)." };
  }
  const b = data as Partial<PhoneBackup> | null;
  if (!b || typeof b !== "object" || b.format !== PHONE_BACKUP_FORMAT) {
    return { ok: false, error: "This file is not a backup from this app." };
  }
  if (typeof b.schema !== "number" || b.schema > MIGRATIONS.length) {
    return { ok: false, error: "This backup was made by a newer version of the app. Update the app, then try again." };
  }
  if (!b.tables || typeof b.tables !== "object") return { ok: false, error: "This backup has no data in it." };
  let rows = 0;
  for (const [name, list] of Object.entries(b.tables)) {
    if (!(TABLES as readonly string[]).includes(name)) return { ok: false, error: `This backup has a part this app does not know (${name}).` };
    if (!Array.isArray(list)) return { ok: false, error: `This backup's ${name} part is damaged.` };
    rows += list.length;
  }
  return { ok: true, backup: b as PhoneBackup, rows };
}

const SAFE_NAME = /^[a-z_]+$/;

/**
 * Replaces everything on the phone with the backup, in one transaction: if any row fails, nothing changes. Only columns
 * the table has are written; a field the table has no column for stops the restore, so data is never dropped quietly.
 */
export async function restoreBackup(db: Db, backup: PhoneBackup): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`, []);
    await db.runAsync("DELETE FROM sqlite_sequence", []).catch(() => undefined);
    for (const t of TABLES) {
      const rows = backup.tables[t] ?? [];
      if (rows.length === 0) continue;
      const cols = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`, [])).map((c) => c.name));
      for (const row of rows) {
        const keys = Object.keys(row);
        const unknown = keys.filter((k) => !cols.has(k) || !SAFE_NAME.test(k));
        if (unknown.length) throw new Error(`The backup's ${t} part has fields this app does not know: ${unknown.join(", ")}.`);
        await db.runAsync(
          `INSERT INTO ${t} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
          keys.map((k) => row[k]),
        );
      }
    }
  });
}
