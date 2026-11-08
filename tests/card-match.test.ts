import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import jpeg from "jpeg-js";
import { TAROT_DECK } from "../src/core/cards";
import { CARD_PRINTS } from "../src/core/card-prints";
import { cardsNamed, fromBase64, packPrint, printOf, suggestCards, toBase64, turned, unpackPrint, type Pixels } from "../src/core/card-match";
import { makeCardPrints } from "../scripts/card-prints-make";

const root = join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(root, "assets/cards", file));
const pictures = TAROT_DECK.map((c) => {
  const d = jpeg.decode(read(c.fileName), { useTArray: true });
  return { id: c.id, px: { width: d.width, height: d.height, data: d.data } as Pixels };
});
const prints = Object.entries(CARD_PRINTS).map(([cardId, p]) => ({ cardId, print: unpackPrint(p) }));

test("the stored prints match the card pictures, one for each of the 78 cards", () => {
  assert.deepEqual(CARD_PRINTS, makeCardPrints(read), "Run: node --import tsx scripts/card-prints.ts");
  assert.equal(prints.length, 78);
});

test("base64 and packed prints come back the same", () => {
  for (const n of [0, 1, 2, 3, 4, 5, 200]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  }
  assert.equal(toBase64(new TextEncoder().encode("Tower")), "VG93ZXI=");
  const p = printOf(pictures[0].px);
  const back = unpackPrint(packPrint(p));
  let same = 0;
  for (let i = 0; i < p.length; i++) same += p[i] * back[i];
  assert.ok(same > 0.999);
  assert.deepEqual(turned(turned(p)), p);
});

test("each card picture is suggested first for itself, and upside down when turned", () => {
  for (const c of pictures) {
    const [up] = suggestCards(c.px, prints, 1);
    assert.equal(up.cardId, c.id);
    assert.equal(up.reversed, false);
    const data = new Uint8Array(c.px.data.length);
    const n = c.px.width * c.px.height;
    for (let i = 0; i < n; i++) data.set(c.px.data.subarray(i * 4, i * 4 + 4), (n - 1 - i) * 4);
    const [down] = suggestCards({ ...c.px, data }, prints, 1);
    assert.equal(down.cardId, c.id);
    assert.equal(down.reversed, true);
  }
});

/** A made-up phone photo of a card: on a striped cloth, smaller than the frame, tilted, off-centre, in odd light. */
function fakePhoto(card: Pixels, reversed: boolean, rnd: () => number): Pixels {
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const W = 240, H = 320;
  const data = new Uint8Array(W * H * 4);
  const bg = [between(20, 200), between(20, 200), between(20, 200)];
  const scale = (between(0.65, 0.95) * Math.min(H, W / 0.57)) / card.height;
  const angle = (between(-5, 5) * Math.PI) / 180 + (reversed ? Math.PI : 0);
  const cx = W / 2 + between(-0.07, 0.07) * W, cy = H / 2 + between(-0.07, 0.07) * H;
  const gain = between(0.6, 1.25);
  const cast = [between(0.85, 1.15), between(0.85, 1.15), between(0.8, 1.2)];
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = ((x - cx) * cos - (y - cy) * sin) / scale + card.width / 2;
      const v = ((x - cx) * sin + (y - cy) * cos) / scale + card.height / 2;
      let rgb: number[];
      if (u >= 0 && v >= 0 && u < card.width - 1 && v < card.height - 1) {
        const i = (Math.floor(v) * card.width + Math.floor(u)) * 4;
        rgb = [card.data[i], card.data[i + 1], card.data[i + 2]];
      } else {
        const s = Math.sin((x + y) / 12) * 25;
        rgb = bg.map((b) => b + s);
      }
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = Math.max(0, Math.min(255, rgb[k] * gain * cast[k] + between(-12, 12)));
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

test("made-up phone photos: the right card is nearly always among the first three, the right way up", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  let first = 0, topThree = 0, wayUp = 0;
  for (const c of pictures) {
    const reversed = rnd() < 0.5;
    const s = suggestCards(fakePhoto(c.px, reversed, rnd), prints, 3);
    const at = s.findIndex((x) => x.cardId === c.id);
    if (at === 0) first++;
    if (at >= 0) {
      topThree++;
      if (s[at].reversed === reversed) wayUp++;
    }
  }
  assert.ok(first >= 72, `first ${first} of 78`);
  assert.ok(topThree >= 76, `top three ${topThree} of 78`);
  assert.equal(wayUp, topThree);
});

test("picking a card by name: numbers or words, any order of words, nothing for an empty search", () => {
  const names = (q: string) => cardsNamed(TAROT_DECK, q).map((c) => c.name);
  assert.deepEqual(names("3 cups"), ["Three of Cups"]);
  assert.deepEqual(names("three of cups"), ["Three of Cups"]);
  assert.deepEqual(names("cups 3"), ["Three of Cups"]);
  assert.deepEqual(names("tow"), ["The Tower"]);
  assert.deepEqual(names("queen sw"), ["Queen of Swords"]);
  assert.deepEqual(names("  "), []);
  assert.equal(cardsNamed(TAROT_DECK, "cups").length, 8);
});
