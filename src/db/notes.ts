// Signs and dreams, and blind-target trials, in the `notes` table. Plain SQL over the `Db` interface.

import type { Db } from "./types";
import {
  cleanNoteBody, cleanOptions, isNoteKind, parseTrial, pickTarget, type NoteKind, type Trial,
} from "../core/practice";

const now = () => new Date().toISOString();

export interface NoteRow {
  id: number;
  kind: string;
  body: string;
  extra: string;
  created_at: string;
}

// ── Signs and dreams ────────────────────────────────────────────────────────────────────────────────

export async function addNote(db: Db, kind: NoteKind, body: string): Promise<number> {
  const c = cleanNoteBody(body);
  if (!c.ok) throw new Error(c.error);
  if (!isNoteKind(kind)) throw new Error("A note is a sign or a dream.");
  return (await db.runAsync("INSERT INTO notes (kind, body, extra, created_at) VALUES (?, ?, '{}', ?)", [kind, c.text, now()])).lastInsertRowId;
}

export async function updateNote(db: Db, id: number, kind: NoteKind, body: string): Promise<void> {
  const c = cleanNoteBody(body);
  if (!c.ok) throw new Error(c.error);
  if (!isNoteKind(kind)) throw new Error("A note is a sign or a dream.");
  await db.runAsync("UPDATE notes SET kind = ?, body = ? WHERE id = ? AND kind IN ('sign', 'dream')", [kind, c.text, id]);
}

export async function listNotes(db: Db, kind: NoteKind | null = null): Promise<NoteRow[]> {
  return kind
    ? db.getAllAsync<NoteRow>("SELECT * FROM notes WHERE kind = ? ORDER BY created_at DESC, id DESC", [kind])
    : db.getAllAsync<NoteRow>("SELECT * FROM notes WHERE kind IN ('sign', 'dream') ORDER BY created_at DESC, id DESC", []);
}

export async function getNote(db: Db, id: number): Promise<NoteRow | null> {
  return db.getFirstAsync<NoteRow>("SELECT * FROM notes WHERE id = ?", [id]);
}

export async function deleteNote(db: Db, id: number): Promise<void> {
  await db.runAsync("DELETE FROM notes WHERE id = ?", [id]);
}

// ── Blind-target trials ─────────────────────────────────────────────────────────────────────────────

export interface TrialRow {
  id: number;
  impression: string;
  createdAt: string;
  trial: Trial;
}

const toTrial = (r: NoteRow): TrialRow | null => {
  const trial = parseTrial(r.extra);
  return trial && { id: r.id, impression: r.body, createdAt: r.created_at, trial };
};

/** Starts a trial: the four targets are kept and one is picked by chance, hidden from the screens until the choice is made. */
export async function startTrial(db: Db, options: string[], rng: () => number): Promise<number> {
  const c = cleanOptions(options);
  if (!c.ok) throw new Error(c.error);
  const trial: Trial = { options: c.options, target: pickTarget(rng), sealedAt: null, choice: null, judgedAt: null };
  return (await db.runAsync("INSERT INTO notes (kind, body, extra, created_at) VALUES ('blind', '', ?, ?)", [JSON.stringify(trial), now()])).lastInsertRowId;
}

export async function getTrial(db: Db, id: number): Promise<TrialRow | null> {
  const r = await db.getFirstAsync<NoteRow>("SELECT * FROM notes WHERE id = ? AND kind = 'blind'", [id]);
  return r ? toTrial(r) : null;
}

export async function listTrials(db: Db): Promise<TrialRow[]> {
  const rows = await db.getAllAsync<NoteRow>("SELECT * FROM notes WHERE kind = 'blind' ORDER BY created_at DESC, id DESC", []);
  return rows.map(toTrial).filter((t): t is TrialRow => t !== null);
}

async function saveTrial(db: Db, id: number, impression: string, trial: Trial) {
  await db.runAsync("UPDATE notes SET body = ?, extra = ? WHERE id = ? AND kind = 'blind'", [impression, JSON.stringify(trial), id]);
}

/** Seals the impression with the time. It cannot be changed afterwards. */
export async function sealImpression(db: Db, id: number, impression: string): Promise<void> {
  const t = await getTrial(db, id);
  if (!t) throw new Error("This trial is no longer here.");
  if (t.trial.sealedAt) throw new Error("This impression is already sealed.");
  const c = cleanNoteBody(impression);
  if (!c.ok) throw new Error(c.error);
  await saveTrial(db, id, c.text, { ...t.trial, sealedAt: now() });
}

/** The person's choice, after the impression is sealed. Then the target can be shown. */
export async function chooseOption(db: Db, id: number, choice: number): Promise<void> {
  const t = await getTrial(db, id);
  if (!t) throw new Error("This trial is no longer here.");
  if (!t.trial.sealedAt) throw new Error("Seal your impression first.");
  if (t.trial.judgedAt) throw new Error("This trial already has a choice.");
  if (!Number.isInteger(choice) || choice < 0 || choice >= t.trial.options.length) throw new Error("Choose one of the four.");
  await saveTrial(db, id, t.impression, { ...t.trial, choice, judgedAt: now() });
}
