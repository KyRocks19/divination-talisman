/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./node-db";
import { getMeanings, getReading, listReadings, meaningHistory, migrate, saveMeaning } from "../src/db/queries";
import { listPredictions, listTags, tagsForReading } from "../src/db/predictions";
import { checkDesktopExport, reportLines } from "../src/core/desktop-import";
import { applyDesktopImport } from "../src/db/desktop-import";

async function fresh() {
  const db = memoryDb();
  await migrate(db);
  return db;
}

/** The shape app/api/export makes in the desktop app (format=json), cut down. */
const exportFile = () => ({
  exported_at: "2026-11-01T10:00:00.000Z",
  account: { username: "kylie", display_name: "Kylie", sigil: null },
  preferences: { hemisphere: "north" },
  readings: [
    {
      id: 7,
      created_at: "2026-10-20T08:30:00.000Z",
      spread_name: "Three Card",
      title: "Moving house",
      question: "How will the move go?",
      notes: "Felt calm.",
      cards: [
        { position: "Past", card_id: "major-0", card_name: "The Fool", reversed: false },
        { position: "Present", card_id: "cups-ace", card_name: "Ace of Cups", reversed: true },
      ],
      clarifiers: { "1": [{ position: "Clarifier", card_id: "swords-queen", card_name: "Queen of Swords", reversed: false }] },
      own_draw: false,
      tags: ["Home", "  big   change "],
      journals: [
        { id: 1, created_at: "2026-10-21T09:00:00.000Z", author: "user", kind: "note", content: "The boxes came." },
        { id: 2, created_at: "2026-10-21T09:01:00.000Z", author: "hiero", kind: "note", content: "AI words" },
      ],
    },
    { id: 8, created_at: "2026-10-22T08:30:00.000Z", spread_name: "One", title: "", question: "", notes: "", cards: [{ card_id: "not-a-card" }] },
  ],
  card_meanings: [
    {
      card_id: "major-0",
      card_name: "The Fool",
      current: { uprightKeywords: "leap", uprightDescription: "Trust the step", reversedKeywords: null, reversedDescription: null },
      updated_at: "2026-10-10T00:00:00.000Z",
      history: [{ saved_at: "2026-09-01T00:00:00.000Z", uprightKeywords: "beginning", uprightDescription: null, reversedKeywords: "hesitation", reversedDescription: null }],
    },
  ],
  tags: [{ name: "Home", color: null }, { name: "unused", color: "#fff" }],
  predictions: [
    {
      tool: "tarot",
      reading: "Moving house",
      written_at: "2026-10-20T08:40:00.000Z",
      first_words: "It goes smoothly",
      current_words: "It mostly goes smoothly",
      look_back_on: "2026-11-20",
      what_happened: null,
      in_your_words: null,
      looked_back_at: null,
    },
    { tool: "runes", reading: "x", written_at: "2026-10-01T00:00:00Z", first_words: "Done", current_words: "Done", look_back_on: null, what_happened: "yes", in_your_words: "it was", looked_back_at: "2026-10-05T00:00:00Z" },
  ],
  first_guesses: [{ guess: "x" }],
  layouts: [],
});

test("the desktop export is checked, and odd files get plain reasons", () => {
  assert.equal(checkDesktopExport("not json").ok, false);
  const ours = checkDesktopExport(JSON.stringify({ format: "divination-talisman-backup-1", tables: {} }));
  assert.ok(!ours.ok && ours.error.includes("Restore from a backup file"));
  assert.equal(checkDesktopExport(JSON.stringify({ hello: 1 })).ok, false);

  const c = checkDesktopExport(JSON.stringify(exportFile()));
  assert.ok(c.ok);
  const d = c.data;
  assert.equal(d.readings.length, 1);
  assert.equal(d.leftOut.readings, 1, "the reading with an unknown card is left out");
  const r = d.readings[0];
  assert.equal(r.question, "How will the move go?");
  assert.equal(r.notes, "Moving house\n\nFelt calm.", "the title is kept in the notes when there is a question too");
  assert.deepEqual(r.pieces.map((p) => [p.positionName, p.pieceId, p.reversed]), [
    ["Past", "major-0", false],
    ["Present", "cups-ace", true],
    ["Clarifier for Present", "swords-queen", false],
  ]);
  assert.deepEqual(r.tags, ["Home", "big change"]);
  assert.deepEqual(r.journals.map((j) => j.body), ["The boxes came."], "only the person's own journal entries");
  assert.deepEqual(d.tags.sort(), ["Home", "big change", "unused"].sort());
  assert.deepEqual(
    d.meanings.map((m) => [m.orientation, m.versions.map((v) => v.text)]),
    [
      ["upright", ["beginning", "leap\n\nTrust the step"]],
      ["reversed", ["hesitation"]],
    ],
  );
  assert.ok(d.notBrought.some((s) => s.includes("first impressions")));
  assert.ok(!d.notBrought.some((s) => s.includes("layouts")), "empty parts are not listed");
});

test("bringing it in adds everything once, and a second time adds nothing", async () => {
  const db = await fresh();
  await saveMeaning(db, "tarot", "major-0", "upright", "My own fool");
  const c = checkDesktopExport(JSON.stringify(exportFile()));
  assert.ok(c.ok);
  const first = await applyDesktopImport(db, c.data);
  assert.deepEqual(first, {
    readings: { added: 1, had: 0 },
    meanings: { added: 2, had: 0 },
    predictions: { added: 2, had: 0 },
    journals: 1,
    tags: 3,
  });

  const [row] = await listReadings(db);
  const full = await getReading(db, row.id);
  assert.equal(full?.pieces.length, 3);
  assert.equal(full?.reading.created_at, "2026-10-20T08:30:00.000Z");
  assert.deepEqual(full?.journal.map((j) => j.body), ["The boxes came."]);
  assert.deepEqual((await tagsForReading(db, row.id)).map((t) => t.name), ["big change", "Home"]);

  const fool = await getMeanings(db, "tarot", "major-0");
  assert.equal(fool.upright?.text, "My own fool", "the person's own meaning stays");
  assert.deepEqual((await meaningHistory(db, fool.upright!.id)).map((h) => h.text).sort(), ["beginning", "leap\n\nTrust the step"].sort());
  assert.equal(fool.reversed?.text, "hesitation");

  const preds = await listPredictions(db);
  assert.equal(preds.length, 2);
  const open = preds.find((p) => !p.outcome)!;
  assert.equal(open.text, "It mostly goes smoothly");
  assert.equal(open.original_text, "It goes smoothly");
  assert.equal(open.look_back_on, "2026-11-20");
  assert.equal(preds.find((p) => p.outcome)?.outcome_note, "it was");

  const again = await applyDesktopImport(db, c.data);
  assert.deepEqual(again, {
    readings: { added: 0, had: 1 },
    meanings: { added: 0, had: 2 },
    predictions: { added: 0, had: 2 },
    journals: 0,
    tags: 0,
  });
  assert.equal((await listReadings(db)).length, 1);
  assert.equal((await listTags(db)).length, 3);
  assert.ok(reportLines(again, c.data).some((l) => l.includes("already here")));
});
