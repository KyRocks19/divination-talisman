/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAROT_DECK, getCardById } from "../src/core/cards";
import { BUILT_IN_SPREADS, getSpread } from "../src/core/spreads";
import { drawForSpread } from "../src/core/draw";
import { recurringCards, summariseSensed } from "../src/core/patterns";
import { cardImageFor } from "../src/lib/card-image-name";

/** A fixed sequence of numbers in [0, 1), so a draw is the same every run. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("the deck has 78 unique cards", () => {
  assert.equal(TAROT_DECK.length, 78);
  assert.equal(new Set(TAROT_DECK.map((c) => c.id)).size, 78);
  assert.equal(getCardById("major-0")?.name, "The Fool");
});

test("every card has a picture in assets/cards and in the require list", () => {
  const list = readFileSync(new URL("../src/lib/card-images.ts", import.meta.url), "utf8");
  for (const c of TAROT_DECK) {
    assert.ok(readFileSync(new URL(`../assets/cards/${c.fileName}`, import.meta.url)).length > 0, c.fileName);
    assert.ok(list.includes(`"${c.fileName}": require("../../assets/cards/${c.fileName}")`), `${c.fileName} is in card-images.ts`);
    assert.equal(cardImageFor(c.id), c.fileName);
  }
});

test("built-in spreads have unique ids and named positions", () => {
  assert.equal(new Set(BUILT_IN_SPREADS.map((s) => s.id)).size, BUILT_IN_SPREADS.length);
  for (const s of BUILT_IN_SPREADS) {
    assert.ok(s.positions.length > 0);
    for (const p of s.positions) assert.ok(p.name && p.description && /^#[0-9a-f]{6}$/.test(p.color));
  }
  assert.equal(getSpread("celtic-cross")?.positions.length, 10);
});

test("a draw gives one different card per position, and never reverses when reversals are off", () => {
  const spread = getSpread("celtic-cross")!;
  for (const reversals of [true, false]) {
    const drawn = drawForSpread(spread, Math.random, reversals);
    assert.equal(drawn.length, 10);
    assert.equal(new Set(drawn.map((d) => d.pieceId)).size, 10);
    assert.deepEqual(drawn.map((d) => d.position), [...Array(10).keys()]);
    assert.deepEqual(drawn.map((d) => d.positionName), spread.positions.map((p) => p.name));
    if (!reversals) assert.ok(drawn.every((d) => !d.reversed));
  }
});

test("a draw is decided by the random numbers alone", () => {
  const spread = getSpread("past-present-future")!;
  const a = drawForSpread(spread, seq(0.1, 0.7, 0.3, 0.9), true);
  const b = drawForSpread(spread, seq(0.1, 0.7, 0.3, 0.9), true);
  assert.deepEqual(a, b);
});

test("every card can come up", () => {
  const seen = new Set<string>();
  const single = getSpread("single")!;
  for (let i = 0; i < 3000 && seen.size < 78; i++) seen.add(drawForSpread(single, Math.random, false)[0].pieceId);
  assert.equal(seen.size, 78);
});

test("recurring cards count readings, not repeats inside one reading", () => {
  const rows = [
    { reading_id: 1, piece_id: "major-0", reversed: 0, created_at: "2026-11-01" },
    { reading_id: 2, piece_id: "major-0", reversed: 1, created_at: "2026-11-03" },
    { reading_id: 2, piece_id: "major-0", reversed: 1, created_at: "2026-11-03" },
    { reading_id: 3, piece_id: "cups-ace", reversed: 0, created_at: "2026-11-04" },
  ];
  assert.deepEqual(recurringCards(rows), [{ tool: "tarot", pieceId: "major-0", name: null, readings: 2, reversed: 1, lastSeen: "2026-11-03" }]);
});

test("the sensed-first summary counts plainly and holds back an average until there are five answers", () => {
  const rows = [
    { skipped: 1, confidence: null, fit: null },
    { skipped: 0, confidence: 5 as const, fit: 4 as const },
    { skipped: 0, confidence: 2 as const, fit: 2 as const },
    { skipped: 0, confidence: null, fit: null },
  ];
  const s = summariseSensed(rows);
  assert.equal(s.written, 3);
  assert.equal(s.setAside, 1);
  assert.equal(s.rated, 2);
  assert.equal(s.average, null);
  assert.equal(s.counts[4], 1);
  const many = summariseSensed(Array.from({ length: 5 }, () => ({ skipped: 0, confidence: 3 as const, fit: 3 as const })));
  assert.equal(many.average, 3);
  assert.deepEqual(many.byConfidence, [{ confidence: 3, rated: 5, fittedWell: 0 }]);
});
