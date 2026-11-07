import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_TOOLS, showsPart, toolPickOptions } from "../src/core/tool-picker";
import { TOOLS } from "../src/core/tools";

test("the picker offers everything first, then tarot, oracle decks, every other tool, and practice", () => {
  const values = toolPickOptions().map((o) => o.value);
  assert.deepEqual(values, [ALL_TOOLS, "tarot", "oracle", ...TOOLS.map((t) => t.id), "practice"]);
  assert.equal(new Set(values).size, values.length);
});

test("one pick shows only its own part of the page", () => {
  assert.ok(showsPart("runes", "runes"));
  assert.ok(!showsPart("runes", "tarot"));
  assert.ok(!showsPart("tarot", "practice"));
});

test("all tools, or a pick the app no longer has, shows every part", () => {
  assert.ok(showsPart(ALL_TOOLS, "tarot"));
  assert.ok(showsPart(ALL_TOOLS, "runes"));
  assert.ok(showsPart("gone-tool", "oracle"));
});
