/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOOLS, castGeomancy, castIChing, coinTally, drawTool, getTool, ichingCastOf, throwDice, throwTotal, toolName,
} from "../src/core/tools";
import { getSpread } from "../src/core/spreads";
import { memoryDb } from "./node-db";
import { createReading, getReading, migrate, patternRows } from "../src/db/queries";

/** A fixed sequence of "random" numbers, so a draw can be checked. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("every tool has pieces with unique ids that can be looked up again", () => {
  for (const tool of TOOLS) {
    const pieces = tool.pieces();
    assert.ok(pieces.length > 0, tool.id);
    assert.equal(new Set(pieces.map((p) => p.id)).size, pieces.length, `${tool.id}: ids are unique`);
    for (const p of pieces) assert.deepEqual(tool.piece(p.id), p, `${tool.id}: ${p.id}`);
    assert.equal(getTool(tool.id), tool);
    assert.equal(toolName(tool.id), tool.name);
  }
  assert.equal(getTool("runes")!.pieces().length, 24);
  assert.equal(getTool("ogham")!.pieces().length, 20);
  assert.equal(getTool("playing-cards")!.pieces().length, 52);
  assert.equal(getTool("iching")!.pieces().length, 64);
  assert.equal(getTool("geomancy")!.pieces().length, 16);
  assert.equal(getTool("nope"), undefined);
  // Meanings line up with the desktop app's ids.
  assert.ok(getTool("playing-cards")!.piece("playing-H-7"));
  assert.ok(getTool("runes")!.piece("rune-fehu"));
  assert.ok(getTool("dice")!.piece("die-d6-3"));
  assert.ok(getTool("dice")!.piece("die-d100-77"), "a d100 face is known even if the page does not list them all");
});

test("only runes carry traditional text among the tools with no single tradition", () => {
  assert.ok(getTool("runes")!.piece("rune-fehu")!.traditional.length >= 2);
  for (const id of ["playing-cards", "dice", "iching", "geomancy"]) {
    const tool = getTool(id)!;
    assert.equal(tool.traditionalLabel, null, id);
    assert.ok(tool.pieces().every((p) => p.traditional.length === 0), `${id} gives no meanings`);
  }
});

test("a rune draw gives each rune once, and reverses only runes that can be", () => {
  const runes = getTool("runes")!;
  const spread = getSpread("celtic-cross") ?? getSpread("past-present-future")!;
  const pieces = drawTool(runes, spread, Math.random, true);
  assert.equal(new Set(pieces.map((p) => p.pieceId)).size, spread.positions.length);
  for (const p of pieces) if (p.reversed) assert.ok(runes.piece(p.pieceId)!.canReverse);
  const off = drawTool(runes, spread, Math.random, false);
  assert.ok(off.every((p) => !p.reversed));
  const ogham = drawTool(getTool("ogham")!, spread, seq(0.1), true);
  assert.ok(ogham.every((p) => !p.reversed), "ogham letters never land reversed");
});

test("a throw lets faces repeat, and totals and coin counts are plain arithmetic", () => {
  const dice = throwDice("d6", 3, seq(0.99, 0.99, 0));
  assert.deepEqual(dice.map((p) => p.pieceId), ["die-d6-6", "die-d6-6", "die-d6-1"]);
  assert.equal(throwTotal(dice.map((p) => p.pieceId)), 13);
  assert.equal(coinTally(dice.map((p) => p.pieceId)), null);
  const coins = throwDice("coin", 4, seq(0.1, 0.9, 0.2, 0.3));
  assert.deepEqual(coinTally(coins.map((p) => p.pieceId)), { heads: 3, tails: 1 });
  assert.equal(throwTotal(coins.map((p) => p.pieceId)), null);
  assert.equal(throwDice("d20", 99, Math.random).length, 12, "at most twelve at once");
  assert.equal(throwDice("coin", 1, seq(0.1))[0].positionName, "Coin");
});

test("an I Ching cast keeps its six lines and gives the hexagram it changes to", () => {
  // Coins: heads (below 0.5) counts 3. Six lines of three tosses each.
  const allHeads = castIChing("coins", seq(0.1));
  assert.equal(allHeads.pieces.length, 2, "old yang everywhere changes every line");
  assert.equal(allHeads.pieces[0].pieceId, "hexagram-1");
  assert.equal(allHeads.pieces[1].pieceId, "hexagram-2");
  assert.deepEqual(ichingCastOf(allHeads.spreadId)?.values, [9, 9, 9, 9, 9, 9]);

  // Two heads and a tail every time: 3 + 3 + 2 = 8, young yin, which stays.
  const steady = castIChing("coins", seq(0.1, 0.1, 0.9));
  assert.equal(steady.pieces.length, 1, "no changing lines, no second hexagram");
  assert.equal(steady.pieces[0].pieceId, "hexagram-2");
  assert.equal(ichingCastOf("past-present-future"), null);
});

test("a geomancy chart has sixteen places, made from four Mothers", () => {
  const chart = castGeomancy(seq(0.1)); // every line a single dot: Via everywhere it is cast
  assert.equal(chart.pieces.length, 16);
  assert.deepEqual(chart.pieces.slice(0, 4).map((p) => p.pieceId), ["geomancy-via", "geomancy-via", "geomancy-via", "geomancy-via"]);
  assert.equal(chart.pieces[14].positionName, "Judge");
  assert.equal(chart.pieces[14].pieceId, "geomancy-populus", "Via added to Via is Populus");
  assert.match(chart.spreadId, /^geomancy:[12]{16}$/);
});

test("a reading from any tool is saved and counted like tarot", async () => {
  const db = memoryDb();
  await migrate(db);
  const cast = castIChing("yarrow", Math.random);
  const id = await createReading(db, { tool: "iching", question: "", spreadId: cast.spreadId, spreadName: cast.spreadName, pieces: cast.pieces, sensed: null });
  const r = await getReading(db, id);
  assert.equal(r?.reading.tool, "iching");
  assert.ok(ichingCastOf(r!.reading.spread_id));
  const rows = await patternRows(db);
  assert.ok(rows.pieces.every((p) => p.tool === "iching"));
});
