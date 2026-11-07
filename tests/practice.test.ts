/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./node-db";
import { migrate } from "../src/db/queries";
import { addNote, chooseOption, deleteNote, getTrial, listNotes, listTrials, sealImpression, startTrial, updateNote } from "../src/db/notes";
import { chanceOfAtLeast, chanceWords, cleanOptions, practiceNumbers, trialState } from "../src/core/practice";
import { drawLots, lotNames, SWINGS, getTool } from "../src/core/tools";
import { checkBackup, makeBackup, restoreBackup } from "../src/db/backup";

async function fresh() {
  const db = memoryDb();
  await migrate(db);
  return db;
}

test("signs and dreams are written, changed, listed by kind and deleted", async () => {
  const db = await fresh();
  const a = await addNote(db, "sign", "  Three crows on the fence ");
  await addNote(db, "dream", "Flying over water");
  assert.equal((await listNotes(db)).length, 2);
  assert.deepEqual((await listNotes(db, "sign")).map((n) => n.body), ["Three crows on the fence"]);
  await updateNote(db, a, "dream", "Three crows, in a dream");
  assert.equal((await listNotes(db, "dream")).length, 2);
  await assert.rejects(addNote(db, "sign", "   "));
  await assert.rejects(addNote(db, "omen" as never, "x"));
  await deleteNote(db, a);
  assert.equal((await listNotes(db)).length, 1);
});

test("a blind-target trial goes open, sealed, judged, and only in that order", async () => {
  const db = await fresh();
  assert.equal(cleanOptions(["a", "b", "c"]).ok, false);
  assert.equal(cleanOptions(["a", "b", "c", " A "]).ok, false, "the four must differ");
  assert.equal(cleanOptions(["a", "b", "c", ""]).ok, false);

  const id = await startTrial(db, ["Apple", "Sea", "Bus", "Oak"], () => 0.6); // 0.6 * 4 = 2.4: the third
  let t = await getTrial(db, id);
  assert.equal(t?.trial.target, 2);
  assert.equal(trialState(t!.trial), "open");
  await assert.rejects(chooseOption(db, id, 1), /Seal/);

  await sealImpression(db, id, "Something wheeled and loud");
  t = await getTrial(db, id);
  assert.equal(trialState(t!.trial), "sealed");
  await assert.rejects(sealImpression(db, id, "changed my mind"), /already/);

  await chooseOption(db, id, 2);
  t = await getTrial(db, id);
  assert.equal(trialState(t!.trial), "judged");
  await assert.rejects(chooseOption(db, id, 1), /already/);

  const other = await startTrial(db, ["1", "2", "3", "4"], () => 0);
  await sealImpression(db, other, "x");
  await chooseOption(db, other, 3);
  await startTrial(db, ["1", "2", "3", "4"], () => 0); // left open: not counted

  const n = practiceNumbers((await listTrials(db)).map((r) => r.trial));
  assert.deepEqual({ trials: n.trials, hits: n.hits, expected: n.expected }, { trials: 2, hits: 1, expected: 0.5 });
  assert.ok(Math.abs(n.chance - (1 - 0.75 ** 2)) < 1e-9);
  assert.equal((await listNotes(db)).length, 0, "trials are not listed with signs and dreams");
});

test("chance arithmetic is the plain binomial", () => {
  assert.equal(chanceOfAtLeast(0, 10), 1);
  assert.equal(chanceOfAtLeast(11, 10), 0);
  assert.ok(Math.abs(chanceOfAtLeast(1, 1) - 0.25) < 1e-12);
  assert.ok(Math.abs(chanceOfAtLeast(2, 2) - 0.0625) < 1e-12);
  assert.equal(chanceWords(0.25), "about 1 in 4");
  assert.equal(chanceWords(0.0001), "under 1 in 1,000");
  assert.equal(chanceWords(1), "almost certain");
});

test("lots: a typed list loses blanks and repeats, and a draw takes each lot once", () => {
  assert.deepEqual(lotNames("The lake\n\n  the LAKE \nThe  city\nStay home\n"), ["The lake", "The city", "Stay home"]);
  const drawn = drawLots(["A", "B", "C"], 5, Math.random);
  assert.equal(drawn.length, 3, "never more than there are");
  assert.equal(new Set(drawn.map((d) => d.pieceId)).size, 3);
  assert.equal(drawLots(["Only"], 1, Math.random)[0].pieceId, "lot:only");
  assert.equal(getTool("lots")!.pieces().length, 0);
});

test("the pendulum's swings have the desktop's ids and the person's own meanings", () => {
  const pendulum = getTool("pendulum")!;
  assert.deepEqual(pendulum.pieces().map((p) => p.id), SWINGS.map((s) => s.id));
  assert.ok(pendulum.piece("swing-line-0"));
  assert.equal(pendulum.traditionalLabel, null);
});

test("notes and trials round-trip through a backup", async () => {
  const db = await fresh();
  await addNote(db, "dream", "A door in the sea");
  const id = await startTrial(db, ["1", "2", "3", "4"], () => 0.3);
  await sealImpression(db, id, "a feeling");
  const backup = await makeBackup(db);
  assert.ok(checkBackup(JSON.stringify(backup)).ok);
  const other = await fresh();
  await restoreBackup(other, backup);
  assert.equal((await listNotes(other))[0].body, "A door in the sea");
  assert.equal(trialState((await getTrial(other, id))!.trial), "sealed");
});

test("a trial keeps where the chance that picked its target came from", async () => {
  const db = memoryDb();
  await migrate(db);
  const id = await startTrial(db, ["1", "2", "3", "4"], () => 0.5, "random.org");
  assert.equal((await getTrial(db, id))!.trial.randomSource, "random.org");
  const old = await startTrial(db, ["1", "2", "3", "4"], () => 0.5);
  assert.equal((await getTrial(db, old))!.trial.randomSource, null);
});
