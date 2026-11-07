/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RANDOM_SETTING, RANDOM_ORG_MAX_COUNT, cleanRandomSetting, cleanRandomUsed, countCalls, drawWith, numbersToAsk, parseRandomOrg,
  poolRng, randomOrgUrl, randomUsedWords, type RandomDeps,
} from "../src/core/random-source";
import { drawForSpread, drawPieces } from "../src/core/draw";
import { getSpread } from "../src/core/spreads";
import { TOOLS, castGeomancy, castIChing, drawLots, drawTool, throwDice } from "../src/core/tools";

/** A stand-in for random.org: answers each request with `count` numbers, and records the addresses asked for. */
function fakeRandomOrg(make: (i: number) => number = (i) => (i * 7919) % 1_000_000_000) {
  const asked: string[] = [];
  const deps: RandomDeps = {
    fetchText: async (url) => {
      asked.push(url);
      const n = Number(new URL(url).searchParams.get("num"));
      return Array.from({ length: n }, (_, i) => String(make(i))).join("\n") + "\n";
    },
    device: Math.random,
  };
  return { deps, asked };
}

const offline: RandomDeps = {
  fetchText: async () => {
    throw new TypeError("Network request failed");
  },
  device: Math.random,
};

test("random.org is the default, and unknown saved values fall back to it", () => {
  assert.equal(DEFAULT_RANDOM_SETTING, "random.org");
  assert.equal(cleanRandomSetting(null), "random.org");
  assert.equal(cleanRandomSetting("nonsense"), "random.org");
  assert.equal(cleanRandomSetting("device"), "device");
  assert.equal(cleanRandomUsed("device-fallback"), "device-fallback");
  assert.equal(cleanRandomUsed(null), null);
  assert.equal(cleanRandomUsed("other"), null);
});

test("the random.org address asks for plain fresh integers and nothing else", () => {
  const u = new URL(randomOrgUrl(12));
  assert.equal(u.origin, "https://www.random.org");
  assert.equal(u.pathname, "/integers/");
  assert.deepEqual(Object.fromEntries(u.searchParams), { num: "12", min: "0", max: "999999999", col: "1", base: "10", format: "plain", rnd: "new" });
  assert.equal(new URL(randomOrgUrl(RANDOM_ORG_MAX_COUNT + 5)).searchParams.get("num"), String(RANDOM_ORG_MAX_COUNT));
});

test("random.org's answer becomes numbers from 0 up to 1, and anything else is refused", () => {
  assert.deepEqual(parseRandomOrg("0\n500000000\n999999999\n", 3), [0, 0.5, 0.999999999]);
  assert.equal(parseRandomOrg("1\n2\n", 3), null, "too few");
  assert.equal(parseRandomOrg("Error: You have used your quota of random bits for today.", 1), null);
  assert.equal(parseRandomOrg("1\n-2\n3", 3), null);
  assert.equal(parseRandomOrg("<html></html>", 1), null);
});

test("a pool hands out its numbers, then says when it had to borrow", () => {
  const p = poolRng([0.1, 0.2], () => 0.9);
  assert.deepEqual([p.rng(), p.rng()], [0.1, 0.2]);
  assert.equal(p.ranShort(), false);
  assert.equal(p.rng(), 0.9);
  assert.equal(p.ranShort(), true);
});

test("every tool is asked enough numbers from random.org, in one request", async () => {
  const spread = getSpread("celtic-cross")!;
  const runs: [string, (rng: () => number) => unknown][] = [
    ["tarot", (rng) => drawForSpread(spread, rng, true)],
    ["oracle deck", (rng) => drawPieces(Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: `Card ${i}` })), spread, rng, true)],
    ["lots", (rng) => drawLots(["a", "b", "c", "d"], 2, rng)],
    ["dice", (rng) => throwDice("d6", 5, rng)],
    ["coins", (rng) => throwDice("coin", 3, rng)],
    ["I Ching coins", (rng) => castIChing("coins", rng)],
    ["I Ching yarrow", (rng) => castIChing("yarrow", rng)],
    ["geomancy", (rng) => castGeomancy(rng)],
    ...TOOLS.filter((t) => t.kind === "draw").map((t): [string, (rng: () => number) => unknown] => [
      t.name,
      (rng) => drawTool(t, spread.positions.length <= t.pieces().length ? spread : getSpread("single")!, rng, true),
    ]),
  ];
  for (const [name, run] of runs) {
    assert.ok(countCalls(run, Math.random) > 0, `${name} uses chance`);
    for (let i = 0; i < 50; i++) {
      const { deps, asked } = fakeRandomOrg((j) => (j * 7919 + i * 104729) % 1_000_000_000);
      const drawn = await drawWith("random.org", run, deps);
      assert.equal(drawn.used, "random.org", name);
      assert.equal(drawn.problem, null, name);
      assert.equal(asked.length, 1, name);
      assert.ok(Number(new URL(asked[0]).searchParams.get("num")) >= countCalls(run, Math.random), name);
    }
  }
  assert.equal(numbersToAsk(() => undefined, Math.random), 0);
});

test("random.org's numbers are the ones that decide the draw", async () => {
  // All zeros from random.org: a 1-to-6 die always shows its first face.
  const { deps } = fakeRandomOrg(() => 0);
  const drawn = await drawWith("random.org", (rng) => throwDice("d6", 3, rng), { ...deps, device: () => 0.99 });
  assert.deepEqual(drawn.result.map((p) => p.pieceId), ["die-d6-1", "die-d6-1", "die-d6-1"]);
});

test("with no connection, the phone's numbers are used and the reason is given", async () => {
  const drawn = await drawWith("random.org", (rng) => throwDice("d6", 2, rng), offline);
  assert.equal(drawn.used, "device-fallback");
  assert.equal(drawn.result.length, 2);
  assert.match(drawn.problem!, /no internet connection/);
});

test("a slow, limited or strange answer from random.org also falls back, and says so", async () => {
  const timedOut = await drawWith("random.org", (rng) => rng(), { ...offline, fetchText: async () => Promise.reject(new Error("timed out")) });
  assert.equal(timedOut.used, "device-fallback");
  assert.match(timedOut.problem!, /did not answer in time/);
  const quota = await drawWith("random.org", (rng) => rng(), { ...offline, fetchText: async () => Promise.reject(new Error("quota")) });
  assert.match(quota.problem!, /daily limit/);
  const garbled = await drawWith("random.org", (rng) => rng(), { ...offline, fetchText: async () => "<html>maintenance</html>" });
  assert.equal(garbled.used, "device-fallback");
  assert.match(garbled.problem!, /something other than the numbers/);
});

test("choosing this phone never asks random.org", async () => {
  let asked = 0;
  const drawn = await drawWith("device", (rng) => castGeomancy(rng), {
    fetchText: async () => (asked++, ""),
    device: Math.random,
  });
  assert.equal(asked, 0);
  assert.equal(drawn.used, "device");
  assert.equal(drawn.problem, null);
});

test("a reading says where its chance came from in plain words", () => {
  assert.equal(randomUsedWords("random.org"), "Chance from random.org");
  assert.equal(randomUsedWords("device", "this browser"), "Chance from this browser's own random numbers");
  assert.match(randomUsedWords("device-fallback"), /because random.org could not be used/);
});
