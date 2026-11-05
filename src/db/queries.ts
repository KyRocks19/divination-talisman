// Every read and write the screens make. Plain SQL over the `Db` interface (src/db/types.ts), so tests/db.test.ts runs
// these same functions on Node's SQLite.

import { MIGRATIONS } from "./schema";
import type { Db, Param } from "./types";
import type { DrawnPiece } from "../core/draw";
import type { Confidence, Fit } from "../core/guess-core";

const now = () => new Date().toISOString();

/** Turns on foreign keys and runs every migration this database has not had yet. Returns the schema version after. */
export async function migrate(db: Db): Promise<number> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version", []);
  let version = row?.user_version ?? 0;
  if (version > MIGRATIONS.length) {
    throw new Error(`This database is from a newer version of the app (schema ${version}; this app knows ${MIGRATIONS.length}).`);
  }
  while (version < MIGRATIONS.length) {
    const step = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(step);
      await db.execAsync(`PRAGMA user_version = ${next};`);
    });
    version = next;
  }
  return version;
}

// ── Readings ────────────────────────────────────────────────────────────────────────────────────────

export interface ReadingRow {
  id: number;
  tool: string;
  question: string;
  spread_id: string | null;
  spread_name: string | null;
  /** The oracle deck a pull was made with; null for tarot, and after the deck is deleted. */
  deck_id: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PieceRow {
  id: number;
  reading_id: number;
  position: number;
  position_name: string;
  piece_id: string;
  reversed: number;
  /** What the piece was called when drawn (migration 2); null on readings made before it. */
  piece_name: string | null;
}

export interface SensedRow {
  reading_id: number;
  guess: string;
  skipped: number;
  confidence: Confidence | null;
  sealed_at: string;
  fit: Fit | null;
  fit_note: string | null;
  fit_at: string | null;
}

export interface NewReading {
  tool: string;
  question: string;
  spreadId: string | null;
  spreadName: string | null;
  deckId?: number | null;
  pieces: DrawnPiece[];
  /** What the person sensed before the reveal. `null` means the step was turned off; `skipped` means they set it aside this time. */
  sensed: { guess: string; skipped: boolean; confidence: Confidence | null; sealedAt: string } | null;
}

/** Saves a reading with its pieces and what was sensed first, all at once, at the moment of drawing. */
export async function createReading(db: Db, r: NewReading): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const t = now();
    const res = await db.runAsync(
      "INSERT INTO readings (tool, question, spread_id, spread_name, deck_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [r.tool, r.question.trim(), r.spreadId, r.spreadName, r.deckId ?? null, t, t],
    );
    id = res.lastInsertRowId;
    for (const p of r.pieces) {
      await db.runAsync(
        "INSERT INTO reading_pieces (reading_id, position, position_name, piece_id, piece_name, reversed) VALUES (?, ?, ?, ?, ?, ?)",
        [id, p.position, p.positionName, p.pieceId, p.pieceName, p.reversed ? 1 : 0],
      );
    }
    if (r.sensed) {
      await db.runAsync(
        "INSERT INTO sensed_first (reading_id, guess, skipped, confidence, sealed_at) VALUES (?, ?, ?, ?, ?)",
        [id, r.sensed.skipped ? "" : r.sensed.guess, r.sensed.skipped ? 1 : 0, r.sensed.skipped ? null : r.sensed.confidence, r.sensed.sealedAt],
      );
    }
  });
  return id;
}

/** Joins piece names in a list row: a character nobody types, so a name with a comma stays whole. */
export const PIECE_NAME_SEPARATOR = String.fromCharCode(31);

export interface ReadingListItem extends ReadingRow {
  piece_ids: string | null;
  /** The pieces' names when drawn, joined by PIECE_NAME_SEPARATOR, in position order. */
  piece_names: string | null;
  guess: string | null;
  skipped: number | null;
  fit: Fit | null;
}

/** Newest first. `search` matches the question, the notes, what was sensed first and journal entries, ignoring case. */
export async function listReadings(db: Db, search = "", limit = 200): Promise<ReadingListItem[]> {
  const q = search.trim();
  const params: Param[] = [];
  let where = "";
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where = `WHERE r.question LIKE ? ESCAPE '\\' OR r.notes LIKE ? ESCAPE '\\' OR s.guess LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM journal_entries j WHERE j.reading_id = r.id AND j.body LIKE ? ESCAPE '\\')`;
    params.push(like, like, like, like);
  }
  params.push(limit);
  return db.getAllAsync<ReadingListItem>(
    `SELECT r.*, s.guess, s.skipped, s.fit,
       (SELECT group_concat(piece_id, ',') FROM (SELECT piece_id FROM reading_pieces p WHERE p.reading_id = r.id ORDER BY position)) AS piece_ids,
       (SELECT group_concat(coalesce(piece_name, ''), char(31)) FROM (SELECT piece_name FROM reading_pieces p WHERE p.reading_id = r.id ORDER BY position)) AS piece_names
     FROM readings r LEFT JOIN sensed_first s ON s.reading_id = r.id
     ${where}
     ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
    params,
  );
}

export interface FullReading {
  reading: ReadingRow;
  pieces: PieceRow[];
  sensed: SensedRow | null;
  journal: JournalRow[];
}

export async function getReading(db: Db, id: number): Promise<FullReading | null> {
  const reading = await db.getFirstAsync<ReadingRow>("SELECT * FROM readings WHERE id = ?", [id]);
  if (!reading) return null;
  const pieces = await db.getAllAsync<PieceRow>("SELECT * FROM reading_pieces WHERE reading_id = ? ORDER BY position", [id]);
  const sensed = await db.getFirstAsync<SensedRow>("SELECT * FROM sensed_first WHERE reading_id = ?", [id]);
  const journal = await db.getAllAsync<JournalRow>("SELECT * FROM journal_entries WHERE reading_id = ? ORDER BY created_at, id", [id]);
  return { reading, pieces, sensed, journal };
}

export async function updateReadingNotes(db: Db, id: number, notes: string): Promise<void> {
  await db.runAsync("UPDATE readings SET notes = ?, updated_at = ? WHERE id = ?", [notes, now(), id]);
}

export async function updateQuestion(db: Db, id: number, question: string): Promise<void> {
  await db.runAsync("UPDATE readings SET question = ?, updated_at = ? WHERE id = ?", [question.trim(), now(), id]);
}

/** Deletes a reading with everything written on it: its pieces, what was sensed first, its journal entries and predictions. */
export async function deleteReading(db: Db, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM journal_entries WHERE reading_id = ?", [id]);
    await db.runAsync("DELETE FROM predictions WHERE reading_id = ?", [id]);
    await db.runAsync("DELETE FROM readings WHERE id = ?", [id]);
  });
}

/** The person's own answer, afterwards, to how well what they sensed fitted. `null` clears it. */
export async function setFit(db: Db, readingId: number, fit: Fit | null, note: string | null): Promise<void> {
  await db.runAsync("UPDATE sensed_first SET fit = ?, fit_note = ?, fit_at = ? WHERE reading_id = ?", [
    fit,
    note?.trim() || null,
    fit === null ? null : now(),
    readingId,
  ]);
}

// ── Journal ─────────────────────────────────────────────────────────────────────────────────────────

export interface JournalRow {
  id: number;
  reading_id: number | null;
  day: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export async function addJournalEntry(db: Db, readingId: number | null, body: string): Promise<number> {
  const t = now();
  const res = await db.runAsync("INSERT INTO journal_entries (reading_id, day, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [
    readingId,
    t.slice(0, 10),
    body.trim(),
    t,
    t,
  ]);
  return res.lastInsertRowId;
}

export async function updateJournalEntry(db: Db, id: number, body: string): Promise<void> {
  await db.runAsync("UPDATE journal_entries SET body = ?, updated_at = ? WHERE id = ?", [body.trim(), now(), id]);
}

export async function deleteJournalEntry(db: Db, id: number): Promise<void> {
  await db.runAsync("DELETE FROM journal_entries WHERE id = ?", [id]);
}

// ── The person's own meanings, with history ─────────────────────────────────────────────────────────

export type Orientation = "upright" | "reversed";

export interface MeaningRow {
  id: number;
  tool: string;
  piece_id: string;
  orientation: Orientation;
  text: string;
  updated_at: string;
}

export interface HistoryRow {
  id: number;
  meaning_id: number;
  text: string;
  saved_at: string;
}

export async function getMeanings(db: Db, tool: string, pieceId: string): Promise<Partial<Record<Orientation, MeaningRow>>> {
  const rows = await db.getAllAsync<MeaningRow>("SELECT * FROM meanings WHERE tool = ? AND piece_id = ?", [tool, pieceId]);
  const out: Partial<Record<Orientation, MeaningRow>> = {};
  for (const r of rows) out[r.orientation] = r;
  return out;
}

/** Every meaning the person has written for a tool, keyed `pieceId:orientation`, for showing theirs first in a reading. */
export async function allMeanings(db: Db, tool: string): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<MeaningRow>("SELECT * FROM meanings WHERE tool = ?", [tool]);
  return new Map(rows.map((r) => [`${r.piece_id}:${r.orientation}`, r.text]));
}

/**
 * Saves the person's meaning. The words it replaces go into the history first (design rule 6: changing a meaning adds a
 * version, it does not erase the old one). Saving empty text deletes the meaning and its history, because the person
 * chose to empty it (design rule 7).
 */
export async function saveMeaning(db: Db, tool: string, pieceId: string, orientation: Orientation, text: string): Promise<void> {
  const clean = text.trim();
  await db.withTransactionAsync(async () => {
    const old = await db.getFirstAsync<MeaningRow>("SELECT * FROM meanings WHERE tool = ? AND piece_id = ? AND orientation = ?", [
      tool,
      pieceId,
      orientation,
    ]);
    if (!clean) {
      if (old) await db.runAsync("DELETE FROM meanings WHERE id = ?", [old.id]);
      return;
    }
    if (old) {
      if (old.text === clean) return;
      await db.runAsync("INSERT INTO meaning_history (meaning_id, text, saved_at) VALUES (?, ?, ?)", [old.id, old.text, old.updated_at]);
      await db.runAsync("UPDATE meanings SET text = ?, updated_at = ? WHERE id = ?", [clean, now(), old.id]);
    } else {
      await db.runAsync("INSERT INTO meanings (tool, piece_id, orientation, text, updated_at) VALUES (?, ?, ?, ?, ?)", [
        tool,
        pieceId,
        orientation,
        clean,
        now(),
      ]);
    }
  });
}

export async function meaningHistory(db: Db, meaningId: number): Promise<HistoryRow[]> {
  return db.getAllAsync<HistoryRow>("SELECT * FROM meaning_history WHERE meaning_id = ? ORDER BY saved_at DESC, id DESC", [meaningId]);
}

export async function deleteHistoryEntry(db: Db, id: number): Promise<void> {
  await db.runAsync("DELETE FROM meaning_history WHERE id = ?", [id]);
}

// ── Settings ────────────────────────────────────────────────────────────────────────────────────────

export interface Settings {
  /** Ask for Face ID, a fingerprint or the phone's passcode when the app opens. */
  lock: boolean;
  /** Offer "write what you sense first" before every reveal. */
  senseFirst: boolean;
  /** Cards can come up reversed. */
  reversals: boolean;
  /** When the last backup file was made, or null. */
  lastBackupAt: string | null;
  /** New oracle photos: a copy inside the app, or a link to the photo in the phone's photo library. */
  photoMode: "copy" | "link";
}

export const DEFAULT_SETTINGS: Settings = { lock: false, senseFirst: true, reversals: true, lastBackupAt: null, photoMode: "copy" };

export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings", []);
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key === "lock" || key === "senseFirst" || key === "reversals") s[key] = value === "1";
    if (key === "lastBackupAt") s.lastBackupAt = value || null;
    if (key === "photoMode") s.photoMode = value === "link" ? "link" : "copy";
  }
  return s;
}

export async function setSetting<K extends keyof Settings>(db: Db, key: K, value: Settings[K]): Promise<void> {
  const v = typeof value === "boolean" ? (value ? "1" : "0") : (value ?? "");
  await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [key, String(v)]);
}

export interface PatternPiece {
  reading_id: number;
  tool: string;
  piece_id: string;
  piece_name: string | null;
  reversed: number;
  created_at: string;
}

// ── Rows for Patterns ───────────────────────────────────────────────────────────────────────────────

export async function patternRows(db: Db): Promise<{
  pieces: PatternPiece[];
  sensed: { sealed_at: string; skipped: number; confidence: Confidence | null; fit: Fit | null }[];
  readings: number;
}> {
  const pieces = await db.getAllAsync<PatternPiece>(
    "SELECT p.reading_id, r.tool, p.piece_id, p.piece_name, p.reversed, r.created_at FROM reading_pieces p JOIN readings r ON r.id = p.reading_id",
    [],
  );
  const sensed = await db.getAllAsync<{ sealed_at: string; skipped: number; confidence: Confidence | null; fit: Fit | null }>(
    "SELECT sealed_at, skipped, confidence, fit FROM sensed_first",
    [],
  );
  const count = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM readings", []);
  return { pieces, sensed, readings: count?.n ?? 0 };
}
