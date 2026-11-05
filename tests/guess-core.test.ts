/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_FIT_NOTE_LENGTH, MAX_GUESS_LENGTH, MIN_FITS_FOR_AVERAGE,
  averageFit, cleanFit, cleanFitNote, cleanGuessText, cleanLogicText, countGuesses, fitsByMonth, meaningsHeldBack, type Fit, type Guess,
} from "../src/core/guess-core";

const written: Guess = { divination_id: 1, guess: "Something to let go of", skipped: false, sealed_at: "2026-10-21T10:00:00Z", fit: null, fit_note: null, fit_at: null, confidence: null, companion_ok: false, logic: null };

test("cleanGuessText trims, refuses empty and over-long words", () => {
  assert.deepEqual(cleanGuessText("  a door  "), { ok: true, text: "a door" });
  assert.equal(cleanGuessText("   ").ok, false);
  assert.equal(cleanGuessText(undefined).ok, false);
  assert.equal(cleanGuessText(42).ok, false);
  assert.equal(cleanGuessText("x".repeat(MAX_GUESS_LENGTH)).ok, true);
  assert.equal(cleanGuessText("x".repeat(MAX_GUESS_LENGTH + 1)).ok, false);
});

test("cleanFit accepts 1 to 5 and null, nothing else", () => {
  for (const n of [1, 2, 3, 4, 5]) assert.equal(cleanFit(n), n);
  assert.equal(cleanFit(null), null);
  for (const bad of [0, 6, 2.5, "3", undefined, NaN]) assert.equal(cleanFit(bad), undefined);
});

test("cleanFitNote trims, empties to null and refuses too long", () => {
  assert.equal(cleanFitNote("  hm "), "hm");
  assert.equal(cleanFitNote("   "), null);
  assert.equal(cleanFitNote(undefined), null);
  assert.equal(cleanFitNote(7), undefined);
  assert.equal(cleanFitNote("x".repeat(MAX_FIT_NOTE_LENGTH + 1)), undefined);
});

test("meanings are closed until the answer is known, then while the step is on and nothing is written", () => {
  assert.equal(meaningsHeldBack({ loaded: false, stepOn: false, guess: null }), true);
  assert.equal(meaningsHeldBack({ loaded: true, stepOn: true, guess: null }), true);
  assert.equal(meaningsHeldBack({ loaded: true, stepOn: true, guess: written }), false);
  assert.equal(meaningsHeldBack({ loaded: true, stepOn: true, guess: { ...written, guess: "", skipped: true } }), false);
  assert.equal(meaningsHeldBack({ loaded: true, stepOn: false, guess: null }), false);
});

test("an average appears only after enough answers", () => {
  const rows = [5, 3, 4, 4].map((fit) => ({ key: "runes", fit: fit as 3 | 4 | 5 }));
  rows.push({ key: "runes", fit: null as never });
  const c = countGuesses(rows).get("runes")!;
  assert.deepEqual(c, { written: 5, rated: 4, fitTotal: 16 });
  assert.equal(averageFit(c), null);
  const more = countGuesses([...rows, { key: "runes", fit: 2 as never }]).get("runes")!;
  assert.equal(more.rated, MIN_FITS_FOR_AVERAGE);
  assert.equal(averageFit(more), 3.6);
});

test("fit answers are counted by the month the guess was sealed, newest first, with an average only after enough answers", () => {
  const rows: { sealed_at: string; fit: Fit | null }[] = [
    { sealed_at: "2026-09-03T10:00:00.000Z", fit: 5 },
    { sealed_at: "2026-09-20T10:00:00.000Z", fit: 3 },
    { sealed_at: "2026-09-21T10:00:00.000Z", fit: null },
    ...Array.from({ length: MIN_FITS_FOR_AVERAGE }, (_, i) => ({ sealed_at: `2026-10-0${i + 1}T10:00:00.000Z`, fit: (i % 2 ? 2 : 4) as Fit })),
  ];
  const months = fitsByMonth(rows);
  assert.deepEqual(months.map((m) => m.month), ["2026-10", "2026-09"]);
  assert.equal(months[1].rated, 2, "a guess with no answer is left out");
  assert.equal(months[1].counts[5], 1);
  assert.equal(months[1].counts[3], 1);
  assert.equal(months[1].average, null, "two answers are too few for an average");
  assert.equal(months[0].rated, MIN_FITS_FOR_AVERAGE);
  assert.equal(months[0].average, Math.round(((4 * 3 + 2 * 2) / 5) * 10) / 10);
  assert.deepEqual(fitsByMonth([]), []);
});

