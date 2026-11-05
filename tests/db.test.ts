/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./node-db";
import { MIGRATIONS, TABLES } from "../src/db/schema";
import {
  addJournalEntry, createReading, deleteReading, getMeanings, getReading, getSettings, listReadings, meaningHistory, migrate,
  patternRows, saveMeaning, setFit, setSetting, updateReadingNotes,
} from "../src/db/queries";
import { backupFileName, checkBackup, makeBackup, restoreBackup } from "../src/db/backup";

async function fresh() {
  const db = memoryDb();
  await migrate(db);
  return db;
}

const tarot = (question = "What do I need to see?") => ({
  tool: "tarot",
  question,
  spreadId: "past-present-future",
  spreadName: "Past | Present | Future",
  pieces: [
    { position: 0, positionName: "Past", pieceId: "major-0", pieceName: "The Fool", reversed: false },
    { position: 1, positionName: "Present", pieceId: "cups-ace", pieceName: "Ace of Cups", reversed: true },
    { position: 2, positionName: "Future", pieceId: "swords-queen", pieceName: "Queen of Swords", reversed: false },
  ],
  sensed: { guess: "Something ending, something starting", skipped: false, confidence: 4 as const, sealedAt: "2026-11-05T09:00:00.000Z" },
});

test("migrations run once, make the fourteen tables, and set the version", async () => {
  const db = await fresh();
  const names = (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'", []))
    .map((r) => r.name)
    .sort();
  assert.deepEqual(names, [...TABLES].sort());
  assert.equal(TABLES.length, 14);
  assert.equal(await migrate(db), MIGRATIONS.length, "running again changes nothing");
});

test("a database from a newer app is refused, not changed", async () => {
  const db = memoryDb();
  await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
  await assert.rejects(migrate(db), /newer version/);
});

test("TABLES lists every parent before its children", async () => {
  const db = await fresh();
  for (const t of TABLES) {
    const fks = await db.getAllAsync<{ table: string }>(`PRAGMA foreign_key_list(${t})`, []);
    for (const fk of fks) assert.ok(TABLES.indexOf(fk.table as never) < TABLES.indexOf(t), `${fk.table} comes before ${t}`);
  }
});

test("a reading is saved with its pieces and what was sensed first, and can be read back", async () => {
  const db = await fresh();
  const id = await createReading(db, tarot());
  const full = await getReading(db, id);
  if (!full) throw new Error("no reading");
  assert.equal(full.reading.question, "What do I need to see?");
  assert.deepEqual(full.pieces.map((p) => [p.piece_id, p.reversed]), [["major-0", 0], ["cups-ace", 1], ["swords-queen", 0]]);
  assert.equal(full.sensed?.guess, "Something ending, something starting");
  assert.equal(full.sensed?.confidence, 4);
  assert.equal(full.sensed?.fit, null);
});

test("a set-aside step keeps no words and no confidence", async () => {
  const db = await fresh();
  const id = await createReading(db, { ...tarot(), sensed: { guess: "ignored", skipped: true, confidence: 3, sealedAt: "2026-11-05T09:00:00Z" } });
  const full = await getReading(db, id);
  assert.equal(full?.sensed?.skipped, 1);
  assert.equal(full?.sensed?.guess, "");
  assert.equal(full?.sensed?.confidence, null);
});

test("the list is newest first and search finds the question, notes, sensed words and journal", async () => {
  const db = await fresh();
  const a = await createReading(db, tarot("About work"));
  const b = await createReading(db, tarot("About home"));
  await db.runAsync("UPDATE readings SET created_at = '2026-01-01T00:00:00Z' WHERE id = ?", [a]);
  await updateReadingNotes(db, b, "the kitchen window");
  await addJournalEntry(db, a, "a dream about 100% blue water");
  assert.deepEqual((await listReadings(db)).map((r) => r.id), [b, a]);
  assert.deepEqual((await listReadings(db, "work")).map((r) => r.id), [a]);
  assert.deepEqual((await listReadings(db, "KITCHEN")).map((r) => r.id), [b]);
  assert.deepEqual((await listReadings(db, "100%")).map((r) => r.id), [a], "% is matched as itself");
  assert.equal((await listReadings(db, "ending")).length, 2);
  assert.equal((await listReadings(db))[0].piece_ids, "major-0,cups-ace,swords-queen");
});

test("the fit answer is saved and can be cleared", async () => {
  const db = await fresh();
  const id = await createReading(db, tarot());
  await setFit(db, id, 5, "  It was exactly that  ");
  let s = (await getReading(db, id))?.sensed;
  assert.equal(s?.fit, 5);
  assert.equal(s?.fit_note, "It was exactly that");
  assert.ok(s?.fit_at);
  await setFit(db, id, null, null);
  s = (await getReading(db, id))?.sensed;
  assert.equal(s?.fit, null);
  assert.equal(s?.fit_at, null);
});

test("deleting a reading removes everything written on it, and nothing on other readings", async () => {
  const db = await fresh();
  const id = await createReading(db, tarot());
  const other = await createReading(db, tarot());
  await addJournalEntry(db, id, "goes");
  await addJournalEntry(db, other, "stays");
  await deleteReading(db, id);
  assert.equal((await db.getAllAsync("SELECT * FROM reading_pieces", [])).length, 3);
  assert.equal((await db.getAllAsync("SELECT * FROM sensed_first", [])).length, 1);
  const entries = await db.getAllAsync<{ body: string }>("SELECT body FROM journal_entries", []);
  assert.deepEqual(entries.map((e) => e.body), ["stays"]);
});

test("changing a meaning keeps the old words in its history; emptying it deletes it", async () => {
  const db = await fresh();
  await saveMeaning(db, "tarot", "major-0", "upright", "A leap");
  await saveMeaning(db, "tarot", "major-0", "upright", "A leap");
  await saveMeaning(db, "tarot", "major-0", "upright", "  A leap I chose  ");
  const m = (await getMeanings(db, "tarot", "major-0")).upright;
  assert.equal(m?.text, "A leap I chose");
  const h = await meaningHistory(db, m!.id);
  assert.deepEqual(h.map((x) => x.text), ["A leap"], "saving the same words twice adds no version");
  await saveMeaning(db, "tarot", "major-0", "upright", "   ");
  assert.equal((await getMeanings(db, "tarot", "major-0")).upright, undefined);
  assert.equal((await db.getAllAsync("SELECT * FROM meaning_history", [])).length, 0);
});

test("settings start from the defaults and keep what is set", async () => {
  const db = await fresh();
  assert.deepEqual(await getSettings(db), { lock: false, senseFirst: true, reversals: true, lastBackupAt: null, photoMode: "copy" });
  await setSetting(db, "lock", true);
  await setSetting(db, "senseFirst", false);
  await setSetting(db, "lastBackupAt", "2026-11-05T10:00:00Z");
  assert.deepEqual(await getSettings(db), { lock: true, senseFirst: false, reversals: true, lastBackupAt: "2026-11-05T10:00:00Z", photoMode: "copy" });
});

test("a backup restores to exactly the same data", async () => {
  const db = await fresh();
  const id = await createReading(db, tarot());
  await setFit(db, id, 3, null);
  await addJournalEntry(db, id, "journal words");
  await saveMeaning(db, "tarot", "cups-ace", "reversed", "Holding back");
  await saveMeaning(db, "tarot", "cups-ace", "reversed", "Holding back, then letting go");
  await setSetting(db, "reversals", false);
  const backup = await makeBackup(db, new Date("2026-11-05T10:00:00Z"));

  const text = JSON.stringify(backup);
  const checked = checkBackup(text);
  if (!checked.ok) throw new Error(checked.error);

  const other = await fresh();
  await createReading(other, tarot("this will be replaced"));
  await restoreBackup(other, checked.backup);
  const again = await makeBackup(other, new Date("2026-11-05T10:00:00Z"));
  assert.deepEqual(again, backup);
  // New rows after a restore get fresh ids that do not collide.
  const next = await createReading(other, tarot());
  assert.ok(next > id);
});

test("a damaged or foreign backup is refused in plain words, and a failed restore changes nothing", async () => {
  assert.equal(checkBackup("not json").ok, false);
  assert.match((checkBackup(JSON.stringify({ format: "divination-station-backup-1" })) as { error: string }).error, /not a backup/);
  assert.match(
    (checkBackup(JSON.stringify({ format: "divination-talisman-backup-1", schema: 999, tables: {} })) as { error: string }).error,
    /newer version/,
  );
  assert.match(
    (checkBackup(JSON.stringify({ format: "divination-talisman-backup-1", schema: 1, tables: { users: [] } })) as { error: string }).error,
    /does not know/,
  );

  const db = await fresh();
  await createReading(db, tarot("keep me"));
  const bad = await makeBackup(db);
  bad.tables.readings = [{ ...bad.tables.readings[0], secret_column: "x" }];
  await assert.rejects(restoreBackup(db, bad), /does not know/);
  assert.equal((await listReadings(db))[0].question, "keep me");
});

test("backup file names carry the phone's local date and time", () => {
  assert.equal(backupFileName(new Date(2026, 10, 5, 9, 7)), "divination-talisman-2026-11-05-0907.zip");
});

test("pattern rows hold tarot pieces and every sensed-first row", async () => {
  const db = await fresh();
  await createReading(db, tarot());
  await createReading(db, { ...tarot(), sensed: null });
  const rows = await patternRows(db);
  assert.equal(rows.readings, 2);
  assert.equal(rows.pieces.length, 6);
  assert.equal(rows.sensed.length, 1);
});
