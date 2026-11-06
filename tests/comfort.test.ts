/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COMFORT, gapFor, isSideways, lessMotion, parseComfort, swipeTarget, textLook } from "../src/core/comfort";
import { defaultChoice, lookBackState, pickerGroups, readingTitle, type LookBackRow } from "../src/core/look-back";
import { memoryDb } from "./node-db";
import { addJournalEntry, createReading, getTextSetting, listJournal, migrate, setTextSetting, updateJournalEntry } from "../src/db/queries";
import { checkBackup, makeBackup, restoreBackup } from "../src/db/backup";

test("comfort choices: anything unknown or broken falls back to the standard look", () => {
  assert.deepEqual(parseComfort(null), DEFAULT_COMFORT);
  assert.deepEqual(parseComfort("not json"), DEFAULT_COMFORT);
  assert.deepEqual(parseComfort("[1,2]"), DEFAULT_COMFORT);
  const c = parseComfort(JSON.stringify({ font: "lexend", size: 130, spacing: "roomy", motion: "less", colours: "forest", swipeTabs: false }), ["forest"]);
  assert.deepEqual(c, { font: "lexend", size: 130, spacing: "roomy", motion: "less", colours: "forest", swipeTabs: false });
  const odd = parseComfort(JSON.stringify({ font: "comic", size: 999, colours: "a-theme-that-is-gone", swipeTabs: "no" }), ["forest"]);
  assert.deepEqual(odd, DEFAULT_COMFORT);
  assert.equal(parseComfort(JSON.stringify({ colours: "light" })).colours, "light");
});

test("text looks: size on top of the phone's, roomy spacing, and a named font in place of a made-up bold", () => {
  assert.deepEqual(textLook(DEFAULT_COMFORT, { fontSize: 16, lineHeight: 23 }), { fontSize: 16, lineHeight: 23 });
  assert.deepEqual(textLook(DEFAULT_COMFORT, { fontSize: 17, bold: "semi" }), { fontSize: 17, fontWeight: "600" });
  const big = { ...DEFAULT_COMFORT, size: 150 as const, spacing: "roomy" as const, font: "opendyslexic" as const };
  const look = textLook(big, { fontSize: 16, lineHeight: 23, bold: true });
  assert.equal(look.fontSize, 24);
  assert.equal(look.lineHeight, Math.round(23 * 1.5 * 1.25));
  assert.equal(look.letterSpacing, 0.4);
  assert.equal(look.fontFamily, "OpenDyslexic-Bold");
  assert.equal(look.fontWeight, undefined);
  assert.equal(textLook(big, { fontSize: 16 }, false).fontFamily, undefined, "until the fonts load, the phone's own font");
  assert.equal(gapFor(big, 16), 24);
  assert.equal(gapFor(DEFAULT_COMFORT, 16), 16);
  assert.equal(lessMotion(DEFAULT_COMFORT, false), false);
  assert.equal(lessMotion(DEFAULT_COMFORT, true), true, "the phone's own setting counts");
  assert.equal(lessMotion({ ...DEFAULT_COMFORT, motion: "less" }, false), true);
});

test("swiping: sideways and far enough goes one tab over, and never past the ends", () => {
  assert.equal(isSideways(30, 5), true);
  assert.equal(isSideways(30, 20), false, "a slanted move is a scroll");
  assert.equal(isSideways(10, 0), false, "too small: a tap or a slip");
  assert.equal(swipeTarget("index", -120, 10), "tools", "swiping left goes to the next tab");
  assert.equal(swipeTarget("tools", 120, 10), "index");
  assert.equal(swipeTarget("index", 120, 0), null, "nothing before Today");
  assert.equal(swipeTarget("me", -120, 0), null, "nothing after Me");
  assert.equal(swipeTarget("record", -50, 0), null, "short and slow");
  assert.equal(swipeTarget("record", -50, 0, -0.8), "me", "short but quick");
  assert.equal(swipeTarget("record", -120, 90), null, "too slanted");
});

function row(id: number, guess: string | null, skipped: number | null, fit: number | null): LookBackRow {
  return { id, tool: "tarot", question: "", spread_name: "One card", piece_ids: null, piece_names: null, guess, skipped, fit };
}

test("look back: the newest reading waiting comes first, and any reading can be chosen", () => {
  const rows = [row(5, null, null, null), row(4, "x", 1, null), row(3, "warm", 0, 4), row(2, "cold", 0, null), row(1, "y", 0, null)];
  assert.deepEqual(rows.map(lookBackState), ["nothing-sensed", "nothing-sensed", "looked-back", "waiting", "waiting"]);
  assert.equal(defaultChoice(rows), 2);
  assert.equal(defaultChoice([row(9, null, null, null)]), 9, "with none waiting, the newest reading");
  assert.equal(defaultChoice([]), null, "with no readings, the person's own journal");
  const g = pickerGroups(rows);
  assert.deepEqual(g.waiting.map((r) => r.id), [2, 1]);
  assert.deepEqual(g.others.map((r) => r.id), [5, 4, 3]);
  assert.equal(readingTitle({ question: "  Will it rain?  ", spread_name: null, tool: "tarot" }), "Will it rain?");
  assert.equal(readingTitle({ question: "", spread_name: null, tool: "runes" }), "Runes");
});

test("the journal: entries about a reading, and the person's own, newest first, changed and kept by a backup", async () => {
  const db = memoryDb();
  await migrate(db);
  const id = await createReading(db, { tool: "tarot", question: "", spreadId: "single", spreadName: "One card", pieces: [], sensed: null });
  const a = await addJournalEntry(db, id, "first about the reading");
  await addJournalEntry(db, id, "second about the reading");
  await addJournalEntry(db, null, "just my day");
  assert.deepEqual((await listJournal(db, id)).map((e) => e.body).sort(), ["first about the reading", "second about the reading"]);
  assert.deepEqual((await listJournal(db, null)).map((e) => e.body), ["just my day"]);
  await updateJournalEntry(db, a, "  changed  ");
  assert.ok((await listJournal(db, id)).some((e) => e.body === "changed"));

  await setTextSetting(db, "comfort", JSON.stringify({ font: "atkinson" }));
  const backup = await makeBackup(db);
  assert.ok(checkBackup(JSON.stringify(backup)).ok);
  const other = memoryDb();
  await migrate(other);
  await restoreBackup(other, backup);
  assert.equal((await listJournal(other, null))[0].body, "just my day");
  assert.equal(parseComfort(await getTextSetting(other, "comfort")).font, "atkinson", "the comfort choices come back with a backup");
});
