/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { memoryDb } from "./node-db";
import { MIGRATIONS } from "../src/db/schema";
import { createReading, getMeanings, listReadings, migrate, patternRows, saveMeaning, PIECE_NAME_SEPARATOR } from "../src/db/queries";
import { BACKUP_JSON, checkBackup, makeBackup, makeBackupZip, readBackupFile, restoreBackup } from "../src/db/backup";
import {
  allCardPhotos, cardsById, createCard, createCards, createDeck, deleteCard, deleteDeck, getCard, getDeck, listCards, listDecks, ORACLE_TOOL, updateDeck,
} from "../src/db/oracle";
import { addField, cleanFieldValues, cleanName, numberedNames, parseFieldDefs, parseFieldValues, renameField } from "../src/core/oracle";
import { drawPieces } from "../src/core/draw";
import { getSpread } from "../src/core/spreads";
import { recurringCards } from "../src/core/patterns";

async function fresh() {
  const db = memoryDb();
  await migrate(db);
  return db;
}

function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("expected a value");
  return v;
}

const fields = [
  { id: "f1", name: "Element" },
  { id: "f2", name: "Keywords" },
];

test("field helpers: new ids, no duplicate names, plain errors, and values only for fields the deck has", () => {
  const a = addField([], "Element");
  assert.ok(a.ok);
  const b = addField(a.defs, "  keywords ");
  assert.ok(b.ok);
  assert.deepEqual(b.defs, [
    { id: "f1", name: "Element" },
    { id: "f2", name: "keywords" },
  ]);
  const dup = addField(b.defs, "ELEMENT");
  assert.equal(dup.ok, false);
  // An id is never reused after a field is taken off.
  const c = addField([b.defs[1]], "Colour");
  assert.ok(c.ok);
  assert.equal(c.defs[1].id, "f3");
  const r = renameField(b.defs, "f2", "Element");
  assert.equal(r.ok, false);
  assert.equal(cleanName("   ").ok, false);
  assert.equal(cleanName("x".repeat(121)).ok, false);
  assert.deepEqual(cleanFieldValues(fields, { f1: " Water ", f2: "  ", gone: "old" }), { f1: "Water" });
  assert.deepEqual(parseFieldDefs("not json"), []);
  assert.deepEqual(parseFieldValues(null), {});
});

test("a deck and its cards are made, read back and listed", async () => {
  const db = await fresh();
  const deckId = await createDeck(db, { name: "Moon garden", description: " Drawn by me ", reversals: false, fields });
  const id = await createCard(db, deckId, fields, { name: "Seed", photo: "oracle-photos/a.jpg", photoLinked: false, values: { f1: "Earth", x: "dropped" } });
  await createCard(db, deckId, fields, { name: "Rain", photo: "library-asset-9", photoLinked: true, values: {} });
  const deck = must(await getDeck(db, deckId));
  assert.equal(deck.description, "Drawn by me");
  assert.equal(deck.reversals, false);
  assert.deepEqual(deck.fields, fields);
  assert.equal((await listDecks(db))[0].cardCount, 2);
  const card = must(await getCard(db, id));
  assert.deepEqual(card.values, { f1: "Earth" });
  assert.deepEqual(
    (await listCards(db, deckId)).map((c) => c.name),
    ["Rain", "Seed"],
  );
  const map = await cardsById(db, [id, 999]);
  assert.equal(map.size, 1);
  assert.deepEqual(
    (await allCardPhotos(db)).map((p) => p.linked).sort(),
    [false, true],
  );
});

test("taking a field off the deck takes its value off every card", async () => {
  const db = await fresh();
  const deckId = await createDeck(db, { name: "D", description: "", reversals: true, fields });
  const id = await createCard(db, deckId, fields, { name: "A", photo: null, photoLinked: false, values: { f1: "Fire", f2: "spark" } });
  await updateDeck(db, deckId, { name: "D", description: "", reversals: true, fields: [fields[1]] });
  assert.deepEqual(must(await getCard(db, id)).values, { f2: "spark" });
});

test("deleting a card or a deck deletes their meanings, and pulls keep the names the cards had", async () => {
  const db = await fresh();
  const deckId = await createDeck(db, { name: "D", description: "", reversals: false, fields: [] });
  const a = await createCard(db, deckId, [], { name: "Owl", photo: null, photoLinked: false, values: {} });
  const b = await createCard(db, deckId, [], { name: "Fox", photo: null, photoLinked: false, values: {} });
  await saveMeaning(db, ORACLE_TOOL, String(a), "upright", "Watch quietly");
  await saveMeaning(db, ORACLE_TOOL, String(b), "upright", "A clever way round");
  await saveMeaning(db, "tarot", String(a), "upright", "A tarot meaning with the same id stays");
  await createReading(db, {
    tool: ORACLE_TOOL,
    deckId,
    question: "",
    spreadId: "single",
    spreadName: "One card",
    pieces: [{ position: 0, positionName: "The card", pieceId: String(a), pieceName: "Owl", reversed: false }],
    sensed: null,
  });
  await deleteCard(db, a);
  assert.deepEqual(await getMeanings(db, ORACLE_TOOL, String(a)), {});
  assert.ok((await getMeanings(db, "tarot", String(a))).upright);
  const removed = await deleteDeck(db, deckId);
  assert.deepEqual(
    removed.map((c) => c.name),
    ["Fox"],
  );
  assert.deepEqual(await getMeanings(db, ORACLE_TOOL, String(b)), {});
  const [r] = await listReadings(db);
  assert.equal(r.deck_id, null, "the pull stays, no longer tied to the deleted deck");
  assert.equal(r.piece_names?.split(PIECE_NAME_SEPARATOR)[0], "Owl");
});

test("a phone on the first version moves to the second and keeps its readings", async () => {
  const db = memoryDb();
  await db.execAsync(MIGRATIONS[0]);
  await db.execAsync("PRAGMA user_version = 1");
  await db.runAsync("INSERT INTO readings (tool, question, created_at, updated_at) VALUES ('tarot', 'Old question', '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z')", []);
  assert.equal(await migrate(db), MIGRATIONS.length);
  const [r] = await listReadings(db);
  assert.equal(r.question, "Old question");
  assert.equal(r.deck_id, null);
  const deckId = await createDeck(db, { name: "After", description: "", reversals: false, fields: [] });
  assert.ok(await getDeck(db, deckId));
});

test("a pull from a deck: too few cards is refused in plain words, and each card is drawn once", () => {
  const ppf = must(getSpread("past-present-future"));
  const two = [
    { id: "1", name: "A" },
    { id: "2", name: "B" },
  ];
  assert.throws(() => drawPieces(two, ppf, Math.random, false), /needs 3 cards and the deck has 2/);
  const drawn = drawPieces([...two, { id: "3", name: "C" }], ppf, () => 0.4, false);
  assert.deepEqual(drawn.map((d) => d.pieceId).sort(), ["1", "2", "3"]);
  assert.ok(drawn.every((d) => !d.reversed));
});

test("recurring cards keep tarot and oracle apart and use the oracle card's latest name", () => {
  const rows = [
    { reading_id: 1, tool: "oracle", piece_id: "7", piece_name: "Owl", reversed: 0, created_at: "2026-11-01" },
    { reading_id: 2, tool: "oracle", piece_id: "7", piece_name: "Night owl", reversed: 1, created_at: "2026-11-03" },
    { reading_id: 1, tool: "tarot", piece_id: "7", piece_name: null, reversed: 0, created_at: "2026-11-01" },
  ];
  const got = recurringCards(rows);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0], { tool: "oracle", pieceId: "7", name: "Night owl", readings: 2, reversed: 1, lastSeen: "2026-11-03" });
});

test("pattern rows include oracle pulls with their names", async () => {
  const db = await fresh();
  await createReading(db, {
    tool: ORACLE_TOOL,
    question: "",
    spreadId: "single",
    spreadName: "One card",
    pieces: [{ position: 0, positionName: "The card", pieceId: "5", pieceName: "Lantern", reversed: false }],
    sensed: null,
  });
  const r = await patternRows(db);
  assert.equal(r.pieces[0].tool, ORACLE_TOOL);
  assert.equal(r.pieces[0].piece_name, "Lantern");
});

test("a zip backup holds the data and every picture, and comes back the same; a plain JSON backup still reads", async () => {
  const db = await fresh();
  const deckId = await createDeck(db, { name: "D", description: "", reversals: false, fields });
  const id = await createCard(db, deckId, fields, { name: "Owl", photo: "oracle-photos/a.png", photoLinked: false, values: { f1: "Air" } });
  const backup = await makeBackup(db, new Date("2026-11-05T12:00:00Z"));
  const pic = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const zip = makeBackupZip(backup, [{ cardId: id, ext: "png", bytes: pic }]);

  const inside = unzipSync(zip);
  assert.ok(inside[BACKUP_JSON]);
  assert.deepEqual(JSON.parse(strFromU8(inside[BACKUP_JSON])).photos, { [String(id)]: `photos/card-${id}.png` });

  const read = readBackupFile(zip);
  assert.deepEqual([...read.files[`photos/card-${id}.png`]], [...pic]);
  const checked = checkBackup(read.text);
  assert.ok(checked.ok);

  const other = await fresh();
  await restoreBackup(other, checked.backup);
  assert.deepEqual(must(await getCard(other, id)).values, { f1: "Air" });
  assert.equal(must(await getDeck(other, deckId)).name, "D");

  const plain = readBackupFile(new TextEncoder().encode(JSON.stringify(backup)));
  assert.deepEqual(plain.files, {});
  assert.ok(checkBackup(plain.text).ok);
});

test("numbered names carry on after the highest Card N, whatever else the deck has", () => {
  assert.deepEqual(numberedNames([], 3), ["Card 1", "Card 2", "Card 3"]);
  assert.deepEqual(numberedNames(["Owl", "card 4", "Card 2", "Card 10 fox"], 2), ["Card 5", "Card 6"]);
  assert.deepEqual(numberedNames(["Card 1"], 0), []);
});

test("many cards from photos are added in order, each with its picture, and a second batch does not repeat names", async () => {
  const db = await fresh();
  const deckId = await createDeck(db, { name: "Shells", description: "", reversals: false, fields });
  const photos = [
    { photo: "oracle-photos/1.jpg", linked: false },
    { photo: "library-asset-2", linked: true },
    { photo: "oracle-photos/3.jpg", linked: false },
  ];
  const names = numberedNames((await listCards(db, deckId)).map((c) => c.name), photos.length);
  const ids = await createCards(db, deckId, fields, photos.map((p, i) => ({ name: names[i], photo: p.photo, photoLinked: p.linked, values: {} })));
  assert.equal(ids.length, 3);
  const cards = await listCards(db, deckId);
  const byId = new Map(cards.map((c) => [c.id, c]));
  assert.deepEqual(ids.map((id) => byId.get(id)?.name), ["Card 1", "Card 2", "Card 3"]);
  assert.deepEqual(ids.map((id) => byId.get(id)?.photo), ["oracle-photos/1.jpg", "library-asset-2", "oracle-photos/3.jpg"]);
  assert.equal(byId.get(ids[1])?.photoLinked, true);
  assert.deepEqual(numberedNames(cards.map((c) => c.name), 1), ["Card 4"]);
  assert.equal((await allCardPhotos(db)).length, 3);
});
