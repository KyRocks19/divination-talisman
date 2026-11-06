/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./node-db";
import { createReading, deleteReading, listReadings, migrate } from "../src/db/queries";
import {
  addPrediction, addTagToReading, deletePrediction, deleteTag, duePredictions, getPrediction, listPredictions, listTags,
  predictionsForReading, removeTagFromReading, renameTag, setOutcome, tagsForReading, updatePrediction, cleanTagName,
} from "../src/db/predictions";
import {
  cleanDay, countPredictions, dayAfter, localDay, planReminders, predictionState, reminderMoment, BACKUP_REMINDER_DAYS,
} from "../src/core/predictions";
import { checkBackup, makeBackup, restoreBackup } from "../src/db/backup";

async function fresh() {
  const db = memoryDb();
  await migrate(db);
  return db;
}

async function aReading(db: Awaited<ReturnType<typeof fresh>>, question = "Will the move go well?") {
  return createReading(db, {
    tool: "tarot",
    question,
    spreadId: "single",
    spreadName: "One card",
    pieces: [{ position: 0, positionName: "The card", pieceId: "major-0", pieceName: "The Fool", reversed: false }],
    sensed: null,
  });
}

test("days are the phone's own calendar days", () => {
  const d = new Date(2026, 10, 30, 23, 30);
  assert.equal(localDay(d), "2026-11-30");
  assert.equal(dayAfter(d, 1), "2026-12-01");
  assert.equal(dayAfter(d, 31), "2026-12-31");
  assert.equal(cleanDay("2026-02-30"), null);
  assert.equal(cleanDay("2026-02-28T10:00:00Z"), "2026-02-28");
  assert.equal(cleanDay(7), null);
  assert.deepEqual(reminderMoment("2026-12-01"), new Date(2026, 11, 1, 9, 0, 0, 0));
});

test("a prediction keeps its first words, can be reworded, and is looked back on", async () => {
  const db = await fresh();
  const r = await aReading(db);
  const id = await addPrediction(db, r, "  The boxes arrive on time  ", "2026-11-13");
  let p = await getPrediction(db, id);
  assert.equal(p?.text, "The boxes arrive on time");
  assert.equal(p?.original_text, "The boxes arrive on time");
  assert.equal(p?.reading_title, "Will the move go well?");

  await updatePrediction(db, id, "Most boxes arrive on time", "2026-11-20");
  p = await getPrediction(db, id);
  assert.equal(p?.text, "Most boxes arrive on time");
  assert.equal(p?.original_text, "The boxes arrive on time", "the first words never change");
  assert.equal(p?.look_back_on, "2026-11-20");

  assert.equal(predictionState(p!, "2026-11-19"), "waiting");
  assert.equal(predictionState(p!, "2026-11-20"), "due");
  assert.equal((await duePredictions(db, "2026-11-19")).length, 0);
  assert.equal((await duePredictions(db, "2026-11-25")).length, 1);

  await setOutcome(db, id, "partly", "  two were late ");
  p = await getPrediction(db, id);
  assert.equal(p?.outcome, "partly");
  assert.equal(p?.outcome_note, "two were late");
  assert.ok(p?.looked_back_at);
  assert.equal(predictionState(p!, "2026-11-25"), "looked-back");
  assert.equal((await duePredictions(db, "2026-11-25")).length, 0);

  await setOutcome(db, id, null, "ignored");
  p = await getPrediction(db, id);
  assert.equal(p?.outcome, null);
  assert.equal(p?.outcome_note, null);
  assert.equal(p?.looked_back_at, null);

  await assert.rejects(addPrediction(db, r, "   ", null));
  await assert.rejects(setOutcome(db, id, "maybe" as never, null));
});

test("predictions list open ones by day, no date after, looked back last; deleting works both ways", async () => {
  const db = await fresh();
  const r = await aReading(db);
  const late = await addPrediction(db, r, "Late", "2026-12-20");
  const none = await addPrediction(db, null, "On its own, no date", null);
  const soon = await addPrediction(db, r, "Soon", "2026-11-10");
  const done = await addPrediction(db, r, "Done", "2026-11-01");
  await setOutcome(db, done, "yes", null);
  assert.deepEqual((await listPredictions(db)).map((p) => p.id), [soon, late, none, done]);
  assert.equal((await predictionsForReading(db, r)).length, 3);

  const counts = countPredictions(await listPredictions(db), "2026-11-15");
  assert.deepEqual(counts, { total: 4, due: 1, waiting: 1, noDate: 1, outcomes: { yes: 1, partly: 0, no: 0, unclear: 0 } });

  await deletePrediction(db, late);
  await deleteReading(db, r);
  assert.deepEqual((await listPredictions(db)).map((p) => p.id), [none], "a reading's predictions go with it; one on its own stays");
});

test("reminders: one per look-back day, never in the past, never quoting the words; backup 30 days on", () => {
  const now = new Date(2026, 10, 6, 12, 0);
  const plan = planReminders({
    predictions: [
      { id: 1, look_back_on: "2026-11-10", outcome: null },
      { id: 2, look_back_on: "2026-11-10", outcome: null },
      { id: 3, look_back_on: "2026-11-20", outcome: null },
      { id: 4, look_back_on: "2026-11-06", outcome: null }, // 9 this morning has passed
      { id: 5, look_back_on: "2026-11-30", outcome: "yes" },
      { id: 6, look_back_on: null, outcome: null },
    ],
    lookBack: true,
    backup: true,
    lastBackupAt: new Date(2026, 10, 1, 8, 0).toISOString(),
    hasReadings: true,
    now,
  });
  assert.deepEqual(
    plan.map((p) => [p.key, p.url]),
    [
      ["look-back-2026-11-10", "/predictions"],
      ["look-back-2026-11-20", "/prediction/3"],
      ["backup", "/me"],
    ],
  );
  assert.equal(plan[0].title, "2 predictions to look back on");
  assert.deepEqual(plan[2].at, new Date(2026, 11, 1, 10, 0));
  assert.equal(BACKUP_REMINDER_DAYS, 30);

  const off = planReminders({ predictions: [{ id: 1, look_back_on: "2026-11-10", outcome: null }], lookBack: false, backup: false, lastBackupAt: null, hasReadings: true, now });
  assert.equal(off.length, 0);

  const overdue = planReminders({ predictions: [], lookBack: true, backup: true, lastBackupAt: "2026-01-01T00:00:00Z", hasReadings: true, now });
  assert.deepEqual(overdue[0].at, new Date(2026, 10, 7, 10, 0), "an overdue backup is reminded tomorrow");

  const empty = planReminders({ predictions: [], lookBack: true, backup: true, lastBackupAt: null, hasReadings: false, now });
  assert.equal(empty.length, 0, "nothing to back up, no reminder");
});

test("tags: names ignore case, rename joins, delete keeps readings, and Record filters by tag", async () => {
  const db = await fresh();
  const a = await aReading(db, "Work question");
  const b = await aReading(db, "Family question");
  const work = await addTagToReading(db, a, "Work");
  assert.equal(await addTagToReading(db, b, "  work "), work, "the same tag, whatever the case");
  const fam = await addTagToReading(db, b, "family");
  await addTagToReading(db, b, "family");
  assert.deepEqual((await tagsForReading(db, b)).map((t) => t.name), ["family", "Work"]);
  assert.deepEqual((await listTags(db)).map((t) => [t.name, t.readings]), [["family", 1], ["Work", 2]]);

  assert.deepEqual((await listReadings(db, "", 200, fam)).map((r) => r.id), [b]);
  assert.deepEqual((await listReadings(db, "fami")).map((r) => r.id), [b], "search finds tag names");
  assert.deepEqual((await listReadings(db, "question", 200, work)).map((r) => r.id).sort(), [a, b].sort());

  await renameTag(db, fam, "WORK");
  assert.deepEqual((await listTags(db)).map((t) => [t.name, t.readings]), [["Work", 2]], "renaming onto another tag joins them");

  await removeTagFromReading(db, a, work);
  assert.deepEqual((await listTags(db)).map((t) => t.readings), [1]);
  await deleteTag(db, work);
  assert.equal((await listTags(db)).length, 0);
  assert.equal((await listReadings(db)).length, 2, "readings stay");

  assert.equal(cleanTagName("  two   words "), "two words");
  assert.equal(cleanTagName(""), null);
  assert.equal(cleanTagName("x".repeat(41)), null);
  await assert.rejects(addTagToReading(db, a, "   "));
});

test("predictions and tags round-trip through a backup", async () => {
  const db = await fresh();
  const r = await aReading(db);
  const id = await addPrediction(db, r, "It goes well", "2026-12-01");
  await setOutcome(db, id, "yes", "It did");
  await addTagToReading(db, r, "moving");
  const backup = await makeBackup(db);
  const checked = checkBackup(JSON.stringify(backup));
  assert.ok(checked.ok);

  const other = await fresh();
  await restoreBackup(other, backup);
  const p = await getPrediction(other, id);
  assert.equal(p?.original_text, "It goes well");
  assert.equal(p?.outcome_note, "It did");
  assert.deepEqual((await tagsForReading(other, r)).map((t) => t.name), ["moving"]);
});
