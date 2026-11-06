// Predictions and tags: reads and writes. Plain SQL over the `Db` interface, so tests/predictions.test.ts runs them on
// Node's SQLite.

import type { Db } from "./types";
import { cleanPredictionText, isOutcome, type Outcome } from "../core/predictions";

const now = () => new Date().toISOString();

// ── Predictions ─────────────────────────────────────────────────────────────────────────────────────

export interface PredictionRow {
  id: number;
  reading_id: number | null;
  /** The words as the person has them now. */
  text: string;
  /** The words first written; never changed. Null only on a prediction made before migration 3 (there were none). */
  original_text: string | null;
  look_back_on: string | null;
  outcome: Outcome | null;
  outcome_note: string | null;
  looked_back_at: string | null;
  created_at: string;
}

export interface PredictionListItem extends PredictionRow {
  /** The reading's question or spread name, for the list. */
  reading_title: string | null;
  reading_at: string | null;
}

export async function addPrediction(db: Db, readingId: number | null, text: string, lookBackOn: string | null): Promise<number> {
  const c = cleanPredictionText(text);
  if (!c.ok) throw new Error(c.error);
  const res = await db.runAsync(
    "INSERT INTO predictions (reading_id, text, original_text, look_back_on, created_at) VALUES (?, ?, ?, ?, ?)",
    [readingId, c.text, c.text, lookBackOn, now()],
  );
  return res.lastInsertRowId;
}

/** Rewords a prediction or moves its look-back day. The first words stay as they were. */
export async function updatePrediction(db: Db, id: number, text: string, lookBackOn: string | null): Promise<void> {
  const c = cleanPredictionText(text);
  if (!c.ok) throw new Error(c.error);
  await db.runAsync("UPDATE predictions SET text = ?, look_back_on = ? WHERE id = ?", [c.text, lookBackOn, id]);
}

/** The person's answer about what happened. `null` takes it back, and the prediction is open again. */
export async function setOutcome(db: Db, id: number, outcome: Outcome | null, note: string | null): Promise<void> {
  if (outcome !== null && !isOutcome(outcome)) throw new Error("That answer is not one of the choices.");
  await db.runAsync("UPDATE predictions SET outcome = ?, outcome_note = ?, looked_back_at = ? WHERE id = ?", [
    outcome,
    outcome === null ? null : note?.trim() || null,
    outcome === null ? null : now(),
    id,
  ]);
}

export async function deletePrediction(db: Db, id: number): Promise<void> {
  await db.runAsync("DELETE FROM predictions WHERE id = ?", [id]);
}

const LIST_SQL = `SELECT p.*, coalesce(nullif(r.question, ''), r.spread_name) AS reading_title, r.created_at AS reading_at
  FROM predictions p LEFT JOIN readings r ON r.id = p.reading_id`;

export async function getPrediction(db: Db, id: number): Promise<PredictionListItem | null> {
  return db.getFirstAsync<PredictionListItem>(`${LIST_SQL} WHERE p.id = ?`, [id]);
}

export async function predictionsForReading(db: Db, readingId: number): Promise<PredictionRow[]> {
  return db.getAllAsync<PredictionRow>("SELECT * FROM predictions WHERE reading_id = ? ORDER BY created_at, id", [readingId]);
}

/** Every prediction: open ones by look-back day (no date last), then the ones looked back on, newest first. */
export async function listPredictions(db: Db): Promise<PredictionListItem[]> {
  return db.getAllAsync<PredictionListItem>(
    `${LIST_SQL} ORDER BY p.outcome IS NOT NULL, CASE WHEN p.outcome IS NULL THEN coalesce(p.look_back_on, '9999') END,
       p.looked_back_at DESC, p.created_at DESC, p.id DESC`,
    [],
  );
}

/** Open predictions whose day has come, soonest first. */
export async function duePredictions(db: Db, today: string): Promise<PredictionListItem[]> {
  return db.getAllAsync<PredictionListItem>(
    `${LIST_SQL} WHERE p.outcome IS NULL AND p.look_back_on IS NOT NULL AND p.look_back_on <= ? ORDER BY p.look_back_on, p.id`,
    [today],
  );
}

// ── Tags ────────────────────────────────────────────────────────────────────────────────────────────

export const MAX_TAG_LENGTH = 40;

export interface TagRow {
  id: number;
  name: string;
}

export interface TagWithCount extends TagRow {
  readings: number;
}

/** A tag name, tidied: inner spaces kept single. Null when empty or too long. */
export function cleanTagName(v: unknown): string | null {
  const name = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (!name || name.length > MAX_TAG_LENGTH) return null;
  return name;
}

export async function listTags(db: Db): Promise<TagWithCount[]> {
  return db.getAllAsync<TagWithCount>(
    "SELECT t.id, t.name, (SELECT count(*) FROM reading_tags rt WHERE rt.tag_id = t.id) AS readings FROM tags t ORDER BY t.name COLLATE NOCASE",
    [],
  );
}

export async function tagsForReading(db: Db, readingId: number): Promise<TagRow[]> {
  return db.getAllAsync<TagRow>(
    "SELECT t.id, t.name FROM tags t JOIN reading_tags rt ON rt.tag_id = t.id WHERE rt.reading_id = ? ORDER BY t.name COLLATE NOCASE",
    [readingId],
  );
}

/** The tag's id, making the tag when there is none by that name (names ignore case). */
export async function ensureTag(db: Db, name: string): Promise<number> {
  const clean = cleanTagName(name);
  if (!clean) throw new Error(`A tag needs a name of up to ${MAX_TAG_LENGTH} characters.`);
  const old = await db.getFirstAsync<{ id: number }>("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [clean]);
  if (old) return old.id;
  return (await db.runAsync("INSERT INTO tags (name) VALUES (?)", [clean])).lastInsertRowId;
}

export async function addTagToReading(db: Db, readingId: number, name: string): Promise<number> {
  const id = await ensureTag(db, name);
  await db.runAsync("INSERT OR IGNORE INTO reading_tags (reading_id, tag_id) VALUES (?, ?)", [readingId, id]);
  return id;
}

export async function removeTagFromReading(db: Db, readingId: number, tagId: number): Promise<void> {
  await db.runAsync("DELETE FROM reading_tags WHERE reading_id = ? AND tag_id = ?", [readingId, tagId]);
}

/** Renames a tag. Renaming it to the name of another tag joins the two. */
export async function renameTag(db: Db, id: number, name: string): Promise<void> {
  const clean = cleanTagName(name);
  if (!clean) throw new Error(`A tag needs a name of up to ${MAX_TAG_LENGTH} characters.`);
  await db.withTransactionAsync(async () => {
    const other = await db.getFirstAsync<{ id: number }>("SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id <> ?", [clean, id]);
    if (other) {
      await db.runAsync("INSERT OR IGNORE INTO reading_tags (reading_id, tag_id) SELECT reading_id, ? FROM reading_tags WHERE tag_id = ?", [
        other.id,
        id,
      ]);
      await db.runAsync("DELETE FROM tags WHERE id = ?", [id]);
    } else {
      await db.runAsync("UPDATE tags SET name = ? WHERE id = ?", [clean, id]);
    }
  });
}

/** Deletes a tag. The readings stay; only the tag comes off them. */
export async function deleteTag(db: Db, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM reading_tags WHERE tag_id = ?", [id]);
    await db.runAsync("DELETE FROM tags WHERE id = ?", [id]);
  });
}
