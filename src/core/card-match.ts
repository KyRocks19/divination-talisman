// Suggesting which tarot card is in a photo, on the phone, with no network and no trained model. Each card picture is
// boiled down to a small grid of colours (a "print"); a photo is printed the same way at a few sizes around its middle,
// and the cards whose prints are closest are suggested, upright or upside down. The person always confirms or picks
// another card: this only saves them scrolling through 78 names.
//
// Pure: works on plain pixel arrays, so the same code makes the stored prints (scripts/card-prints.ts), runs on the
// phone, and is tested in Node.

/** RGBA pixels, four bytes per pixel, row by row. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Grid size of a print. Close to a tarot card's shape (about 4 wide to 7 tall). */
export const GRID_W = 8;
export const GRID_H = 14;
/** Width over height of a tarot card. */
export const CARD_ASPECT = 0.57;
const CHANNELS = 3;
export const PRINT_LENGTH = GRID_W * GRID_H * CHANNELS;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The average colour of each grid cell inside `r`, sampled on a few points per cell to stay quick on big photos. */
function cellColours(px: Pixels, r: Rect): Float32Array {
  const out = new Float32Array(GRID_W * GRID_H * 3);
  const samples = 6;
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      let R = 0, G = 0, B = 0, n = 0;
      for (let sy = 0; sy < samples; sy++) {
        const y = Math.min(px.height - 1, Math.max(0, Math.floor(r.y + ((gy + (sy + 0.5) / samples) / GRID_H) * r.h)));
        for (let sx = 0; sx < samples; sx++) {
          const x = Math.min(px.width - 1, Math.max(0, Math.floor(r.x + ((gx + (sx + 0.5) / samples) / GRID_W) * r.w)));
          const i = (y * px.width + x) * 4;
          R += px.data[i];
          G += px.data[i + 1];
          B += px.data[i + 2];
          n++;
        }
      }
      const c = (gy * GRID_W + gx) * 3;
      out[c] = R / n;
      out[c + 1] = G / n;
      out[c + 2] = B / n;
    }
  }
  return out;
}

/**
 * A print of the part of the picture inside `r`: per cell, brightness and two colour differences, each evened out
 * over the whole card (so a dim room or a warm lamp changes little), then scaled to length 1.
 */
export function printOf(px: Pixels, r: Rect = { x: 0, y: 0, w: px.width, h: px.height }): Float32Array {
  const cells = GRID_W * GRID_H;
  const rgb = cellColours(px, r);
  const out = new Float32Array(cells * CHANNELS);
  for (let c = 0; c < cells; c++) {
    const R = rgb[c * 3], G = rgb[c * 3 + 1], B = rgb[c * 3 + 2];
    out[c * 3] = (R + G + B) / 3;
    out[c * 3 + 1] = R - G;
    out[c * 3 + 2] = (R + G) / 2 - B;
  }
  // Brightness counts more than colour: printed decks and phone cameras disagree most about colour.
  const weight = [1, 0.6, 0.6];
  for (let ch = 0; ch < CHANNELS; ch++) {
    let mean = 0;
    for (let c = 0; c < cells; c++) mean += out[c * 3 + ch];
    mean /= cells;
    let sd = 0;
    for (let c = 0; c < cells; c++) sd += (out[c * 3 + ch] - mean) ** 2;
    sd = Math.sqrt(sd / cells) || 1;
    for (let c = 0; c < cells; c++) out[c * 3 + ch] = ((out[c * 3 + ch] - mean) / sd) * weight[ch];
  }
  let len = 0;
  for (const v of out) len += v * v;
  len = Math.sqrt(len) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= len;
  return out;
}

/** The same print turned upside down: the grid cells in reverse order. */
export function turned(print: Float32Array): Float32Array {
  const cells = print.length / CHANNELS;
  const out = new Float32Array(print.length);
  for (let c = 0; c < cells; c++) {
    const from = (cells - 1 - c) * CHANNELS;
    for (let ch = 0; ch < CHANNELS; ch++) out[c * CHANNELS + ch] = print[from + ch];
  }
  return out;
}

function likeness(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Where the card might be in the photo: card-shaped boxes in the middle at a few sizes, and a little off-centre, since
 * the person is asked to fill the photo with the card but never quite does.
 */
export function candidateBoxes(width: number, height: number): Rect[] {
  const fitH = Math.min(height, width / CARD_ASPECT);
  const boxes: Rect[] = [];
  const steps = [-0.6, -0.3, 0, 0.3, 0.6];
  for (const scale of [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52]) {
    const h = fitH * scale;
    const w = h * CARD_ASPECT;
    for (const dx of steps) {
      for (const dy of steps) {
        const x = (width - w) / 2 + dx * ((width - w) / 2);
        const y = (height - h) / 2 + dy * ((height - h) / 2);
        // Boxes that collapse onto the same place (a box as wide as the photo cannot move sideways) are made once.
        if (boxes.some((b) => Math.abs(b.x - x) < 1 && Math.abs(b.y - y) < 1 && Math.abs(b.h - h) < 1)) continue;
        boxes.push({ x, y, w, h });
      }
    }
  }
  return boxes;
}

export interface Suggestion {
  cardId: string;
  reversed: boolean;
  /** How alike, from -1 to 1. Only used to sort; never shown as a score. */
  likeness: number;
}

/**
 * The cards most like the photo, best first, one entry per card (upright or upside down, whichever is closer).
 * `prints` are the stored prints of the deck's cards, upright.
 */
export function suggestCards(photo: Pixels, prints: { cardId: string; print: Float32Array }[], count = 5): Suggestion[] {
  const photoPrints = candidateBoxes(photo.width, photo.height).map((b) => printOf(photo, b));
  const best: Suggestion[] = prints.map(({ cardId, print }) => {
    const upside = turned(print);
    let top: Suggestion = { cardId, reversed: false, likeness: -Infinity };
    for (const p of photoPrints) {
      const up = likeness(p, print);
      if (up > top.likeness) top = { cardId, reversed: false, likeness: up };
      const down = likeness(p, upside);
      if (down > top.likeness) top = { cardId, reversed: true, likeness: down };
    }
    return top;
  });
  return best.sort((a, b) => b.likeness - a.likeness).slice(0, count);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Bytes as base64 text. Written out here so the same code runs on the phone, on the web and in Node. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

/** Base64 text as bytes. Line breaks and other characters outside base64 are skipped. */
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2] ?? "A") & 63) << 6) | (B64.indexOf(clean[i + 3] ?? "A") & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Stored prints are kept small: each number as one signed byte, the whole print as base64 text. */
const PACK_SCALE = 127 * 4;

export function packPrint(print: Float32Array): string {
  const bytes = new Uint8Array(print.length);
  for (let i = 0; i < print.length; i++) bytes[i] = Math.max(-127, Math.min(127, Math.round(print[i] * PACK_SCALE))) & 255;
  return toBase64(bytes);
}

export function unpackPrint(text: string): Float32Array {
  const bytes = fromBase64(text);
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] > 127 ? bytes[i] - 256 : bytes[i]) / PACK_SCALE;
  let len = 0;
  for (const v of out) len += v * v;
  len = Math.sqrt(len) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= len;
  return out;
}

/**
 * Cards whose name holds every word typed, in deck order, for picking a card by name. "3 cups" and "three of cups"
 * both find the Three of Cups; an empty search finds nothing.
 */
export function cardsNamed<T extends { id: string; name: string }>(cards: T[], query: string, limit = 8): T[] {
  const numbers: Record<string, string> = {
    "1": "ace", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
  };
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== "of" && w !== "the")
    .map((w) => numbers[w] ?? w);
  if (words.length === 0) return [];
  return cards.filter((c) => {
    const name = c.name.toLowerCase().split(/[^a-z0-9]+/);
    return words.every((w) => name.some((n) => n.startsWith(w)));
  }).slice(0, limit);
}
