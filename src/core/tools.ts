// The tools a reading can come from, beyond tarot and the person's own oracle decks: what each one's pieces are, how
// each piece is drawn on screen, the traditional text behind its button, and how a reading is made. Pure: the random
// numbers come in from outside, so the tests can use a fixed sequence.
//
// Every tool keeps its readings in the same `readings` and `reading_pieces` tables, and the person's own meanings in
// `meanings` under the tool's id, so Record, Patterns, tags, predictions and backups work for all of them unchanged.

import { RUNES, RUNE_SOURCES, getRune } from "./tools/runes-data";
import { OGHAM_SOURCES, getStave, stavesFor } from "./tools/ogham-data";
import { HEXAGRAMS, ICHING_SOURCES, LINE_WORDS, castLines, cleanLineValues, getHexagram, resultOf, trigramWords, type LineValue } from "./tools/iching-data";
import { FIGURES, GEOMANCY_SOURCES, PLACES, PLACE_HOW, PLACE_WORDS, buildChart, castMothers, getFigure, mothersToText } from "./tools/geomancy-data";
import { PLAYING_CARDS, PLAYING_CARD_WORDS, getCard, suitOf } from "./tools/playingcards-data";
import { DICE_OBJECTS, faceId, faceLabel, facesOf, getFace, getObject, sideShape, type DiceObjectId } from "./tools/dice-data";
import type { DrawnPiece, Rng } from "./draw";
import type { Spread } from "./spreads";

/** How a piece is drawn: strokes in a 60 by 100 box (runes, ogham), a short text (cards, dice), six lines (I Ching), or four rows of dots (geomancy). */
export type Glyph =
  | { kind: "strokes"; strokes: string[] }
  | { kind: "label"; text: string }
  | { kind: "text"; text: string; red?: boolean }
  | { kind: "lines"; lines: boolean[]; changing?: number[] }
  | { kind: "dots"; lines: number[] };

export interface PieceInfo {
  id: string;
  name: string;
  /** A second line under the name, such as what a rune's name means. */
  subtitle?: string;
  glyph: Glyph;
  canReverse: boolean;
  /** The text behind the tool's button. Empty when the app gives no meaning (playing cards, dice, geomancy). */
  traditional: { label: string; text: string }[];
}

export type ToolKind = "draw" | "throw" | "iching" | "geomancy" | "lots" | "pendulum";

export interface ToolDef {
  id: string;
  name: string;
  /** One line for the Tools list. */
  blurb: string;
  kind: ToolKind;
  /** The words on the button for the traditional text, or null when the app gives none. */
  traditionalLabel: string | null;
  /** Where the tool's text and shapes come from, shown on its page. */
  sources: string[];
  /** Every piece, for the tool's page. */
  pieces: () => PieceInfo[];
  piece: (id: string) => PieceInfo | undefined;
  /** "rune", "stave": the word for one piece. */
  pieceWord: string;
}

// ── Runes ───────────────────────────────────────────────────────────────────────────────────────────

const rune = (id: string): PieceInfo | undefined => {
  const r = getRune(id);
  if (!r) return undefined;
  const traditional = [
    { label: "Old English Rune Poem", text: r.oe },
    ...(r.no ? [{ label: "Norwegian Rune Poem", text: r.no }] : []),
    ...(r.ic ? [{ label: "Icelandic Rune Poem", text: r.ic }] : []),
    { label: "Modern keywords", text: r.modern },
  ];
  return { id: r.id, name: r.name, subtitle: `${r.sound} · ${r.nameMeans}`, glyph: { kind: "strokes", strokes: r.strokes }, canReverse: r.canReverse, traditional };
};

// ── Ogham ───────────────────────────────────────────────────────────────────────────────────────────

const stave = (id: string): PieceInfo | undefined => {
  const s = getStave(id);
  if (!s) return undefined;
  const traditional = [
    ...(s.modern ? [{ label: "Modern keywords", text: s.modern }] : []),
    ...(s.kennings ? [{ label: "Medieval word-ogham", text: s.kennings }] : []),
    ...(s.voices ?? []).map((v) => ({ label: v.who, text: v.text })),
  ];
  return { id: s.id, name: s.name, subtitle: `${s.sound} · ${s.nameMeans}`, glyph: { kind: "strokes", strokes: s.strokes }, canReverse: false, traditional };
};

// ── Playing cards ───────────────────────────────────────────────────────────────────────────────────

/** Playing-card piece ids are the desktop's meaning ids, "playing-H-7", so meanings line up between the two apps. */
const playing = (id: string): PieceInfo | undefined => {
  const c = id.startsWith("playing-") ? getCard(id.slice(8)) : null;
  if (!c) return undefined;
  const s = suitOf(c);
  return { id: c.meaningId, name: c.name, glyph: { kind: "text", text: `${c.rank}${s.symbol}`, red: s.red }, canReverse: false, traditional: [] };
};

// ── Dice and coins ──────────────────────────────────────────────────────────────────────────────────

const face = (id: string): PieceInfo | undefined => {
  const f = getFace(id);
  if (!f) return undefined;
  const shape = sideShape(f.face);
  return {
    id,
    name: f.object === "coin" ? faceLabel(f.face) : `${getObject(f.object)!.name}: ${faceLabel(f.face)}`,
    subtitle: f.object === "knucklebone" && shape ? `The ${shape} side` : undefined,
    glyph: { kind: "text", text: f.object === "coin" ? (f.face === "heads" ? "H" : "T") : f.object === "knucklebone" ? f.face.toUpperCase() : f.face },
    canReverse: false,
    traditional: [],
  };
};

/** The objects a throw can use, in the order offered, leaving out the hundred-sided die from the page's list of pieces. */
export const THROW_OBJECTS = DICE_OBJECTS;

// ── I Ching ─────────────────────────────────────────────────────────────────────────────────────────

const hexagram = (id: string): PieceInfo | undefined => {
  const h = getHexagram(id);
  if (!h) return undefined;
  return {
    id: h.id,
    name: `${h.n} ${h.pinyin}`,
    subtitle: `${h.char} · ${h.english} · ${trigramWords(h)}`,
    glyph: { kind: "lines", lines: h.lines },
    canReverse: false,
    traditional: [],
  };
};

// ── Geomancy ────────────────────────────────────────────────────────────────────────────────────────

const figure = (id: string): PieceInfo | undefined => {
  const f = getFigure(id);
  if (!f) return undefined;
  return { id: f.id, name: f.latin, subtitle: `"${f.english}"`, glyph: { kind: "dots", lines: f.lines }, canReverse: false, traditional: [] };
};

// ── Pendulum ────────────────────────────────────────────────────────────────────────────────────────

/** The five swings every person starts with (the desktop app's BUILTIN_SWINGS), with the same ids for meanings. */
export const SWINGS: { id: string; name: string; words: string; mark: string }[] = [
  { id: "swing-line-0", name: "Back and forth", words: "Swings along a line, towards you and away.", mark: "↕" },
  { id: "swing-line-90", name: "Side to side", words: "Swings along a line, left and right.", mark: "↔" },
  { id: "swing-circle_cw", name: "Circle clockwise", words: "Goes round in a circle, clockwise as seen from above.", mark: "↻" },
  { id: "swing-circle_ccw", name: "Circle counter-clockwise", words: "Goes round in a circle, counter-clockwise as seen from above.", mark: "↺" },
  { id: "swing-still", name: "Still", words: "Does not move.", mark: "·" },
];

const swing = (id: string): PieceInfo | undefined => {
  const s = SWINGS.find((x) => x.id === id);
  return s && { id: s.id, name: s.name, subtitle: s.words, glyph: { kind: "text", text: s.mark }, canReverse: false, traditional: [] };
};

// ── Lots ────────────────────────────────────────────────────────────────────────────────────────────

export const MAX_LOTS = 200;
export const MAX_LOT_NAME = 200;
export const MAX_DRAW_LOTS = 24;

/** The names in a typed list, one to a line: trimmed, blank lines and repeats (ignoring case) dropped, long ones left out. */
export function lotNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name || name.length > MAX_LOT_NAME || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length >= MAX_LOTS) break;
  }
  return out;
}

/** Draws `count` different lots. Each lot's id is its name in lower case, so the same lot is counted together in Patterns. */
export function drawLots(names: string[], count: number, rng: Rng): DrawnPiece[] {
  const n = Math.max(1, Math.min(MAX_DRAW_LOTS, names.length, Math.floor(count)));
  return shuffleTake(names, n, rng).map((name, i) => ({
    position: i,
    positionName: n === 1 ? "The lot" : `Lot ${i + 1}`,
    pieceId: `lot:${name.toLowerCase()}`,
    pieceName: name,
    reversed: false,
  }));
}

// ── The list ────────────────────────────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  {
    id: "runes",
    name: "Runes",
    blurb: "The 24 runes of the Elder Futhark, drawn like cards.",
    kind: "draw",
    traditionalLabel: "Rune poems and keywords",
    sources: Object.values(RUNE_SOURCES),
    pieces: () => RUNES.map((r) => rune(r.id)!),
    piece: rune,
    pieceWord: "rune",
  },
  {
    id: "ogham",
    name: "Ogham",
    blurb: "The 20 letters of the old Irish ogham, drawn like cards.",
    kind: "draw",
    traditionalLabel: "Modern keywords",
    sources: Object.values(OGHAM_SOURCES),
    pieces: () => stavesFor(false).map((s) => stave(s.id)!),
    piece: stave,
    pieceWord: "letter",
  },
  {
    id: "playing-cards",
    name: "Playing cards",
    blurb: "A pack of 52. The app gives no meanings: what each card means is yours to write.",
    kind: "draw",
    traditionalLabel: null,
    sources: [PLAYING_CARD_WORDS.here, "Many written systems of card meanings exist and they disagree, so the app quotes none."],
    pieces: () => PLAYING_CARDS.map((c) => playing(c.meaningId)!),
    piece: playing,
    pieceWord: "card",
  },
  {
    id: "dice",
    name: "Dice and coins",
    blurb: "Toss a coin, throw a knucklebone or dice of 4 to 100 sides.",
    kind: "throw",
    traditionalLabel: null,
    sources: ["Dice and coins have no single tradition to quote, so the app gives no meanings. A total is plain arithmetic."],
    pieces: () =>
      THROW_OBJECTS.filter((o) => o.id !== "d100" && o.id !== "d10" && o.id !== "d12" && o.id !== "d20").flatMap((o) =>
        facesOf(o.id).map((f) => face(faceId(o.id, f))!),
      ),
    piece: face,
    pieceWord: "face",
  },
  {
    id: "iching",
    name: "I Ching",
    blurb: "Cast six lines with three coins or yarrow stalks, and see the hexagram and what it changes to.",
    kind: "iching",
    traditionalLabel: null,
    sources: Object.values(ICHING_SOURCES),
    pieces: () => HEXAGRAMS.map((h) => hexagram(h.id)!),
    piece: hexagram,
    pieceWord: "hexagram",
  },
  {
    id: "geomancy",
    name: "Geomancy",
    blurb: "Four Mothers cast by chance become a chart of sixteen figures.",
    kind: "geomancy",
    traditionalLabel: null,
    sources: Object.values(GEOMANCY_SOURCES),
    pieces: () => FIGURES.map((f) => figure(f.id)!),
    piece: figure,
    pieceWord: "figure",
  },
  {
    id: "pendulum",
    name: "Pendulum",
    blurb: "Ask, swing your own pendulum, and note how it moved. What each swing means is yours to say.",
    kind: "pendulum",
    traditionalLabel: null,
    sources: ["The app gives no meaning to any swing: many people first ask their pendulum to show its yes and its no."],
    pieces: () => SWINGS.map((x) => swing(x.id)!),
    piece: swing,
    pieceWord: "swing",
  },
  {
    id: "lots",
    name: "Lots",
    blurb: "Write a list of names, people, places or choices, and draw from it without looking.",
    kind: "lots",
    traditionalLabel: null,
    sources: ["The app gives no meaning to any lot: you decide what each one stands for."],
    pieces: () => [],
    piece: () => undefined,
    pieceWord: "lot",
  },
];

const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

export function getTool(id: string): ToolDef | undefined {
  return BY_ID.get(id);
}

export const TOOL_NAMES: Record<string, string> = {
  tarot: "Tarot",
  oracle: "Oracle deck",
  ...Object.fromEntries(TOOLS.map((t) => [t.id, t.name])),
};

export function toolName(tool: string): string {
  return TOOL_NAMES[tool] ?? tool;
}

// ── Making a reading ────────────────────────────────────────────────────────────────────────────────

/** Fisher-Yates over a copy, then the first `n`. */
function shuffleTake<T>(list: T[], n: number, rng: Rng): T[] {
  const deck = [...list];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, n);
}

/** A draw from a "draw" tool for a spread: each piece once, reversed only where the piece can be and reversals are on. */
export function drawTool(tool: ToolDef, spread: Spread, rng: Rng, reversals: boolean): DrawnPiece[] {
  const pieces = tool.pieces();
  if (pieces.length < spread.positions.length) throw new Error(`This spread needs ${spread.positions.length} and there are ${pieces.length}.`);
  return shuffleTake(pieces, spread.positions.length, rng).map((p, i) => ({
    position: i,
    positionName: spread.positions[i].name,
    pieceId: p.id,
    pieceName: p.name,
    reversed: reversals && p.canReverse ? rng() < 0.5 : false,
  }));
}

export const MAX_THROW_COUNT = 12;

/** A throw: `count` of one object, each landing on any face (faces repeat). */
export function throwDice(object: DiceObjectId, count: number, rng: Rng): DrawnPiece[] {
  const faces = facesOf(object);
  const n = Math.max(1, Math.min(MAX_THROW_COUNT, Math.floor(count)));
  const obj = getObject(object)!;
  return Array.from({ length: n }, (_, i) => {
    const f = faces[Math.min(faces.length - 1, Math.floor(rng() * faces.length))];
    const id = faceId(object, f);
    return { position: i, positionName: n === 1 ? obj.name : `${obj.name} ${i + 1}`, pieceId: id, pieceName: face(id)!.name, reversed: false };
  });
}

/** The total of a throw of numbered dice, or null for coins and knucklebones. */
export function throwTotal(pieceIds: string[]): number | null {
  const faces = pieceIds.map(getFace);
  if (faces.length === 0 || faces.some((f) => !f || f.object === "coin" || f.object === "knucklebone")) return null;
  return faces.reduce((n, f) => n + Number(f!.face), 0);
}

export function coinTally(pieceIds: string[]): { heads: number; tails: number } | null {
  const faces = pieceIds.map(getFace);
  if (faces.length === 0 || faces.some((f) => f?.object !== "coin")) return null;
  return { heads: faces.filter((f) => f!.face === "heads").length, tails: faces.filter((f) => f!.face === "tails").length };
}

/** An I Ching cast is kept as "iching:<method>:<six line values>" in the reading's spread_id, so the lines can be drawn again. */
export function ichingSpreadId(method: "coins" | "yarrow", values: LineValue[]): string {
  return `iching:${method}:${values.join("")}`;
}

export function ichingCastOf(spreadId: string | null): { method: string; values: LineValue[] } | null {
  const m = /^iching:(coins|yarrow):([6-9]{6})$/.exec(spreadId ?? "");
  const values = m ? cleanLineValues(m[2]) : null;
  return m && values ? { method: m[1], values } : null;
}

export function castIChing(method: "coins" | "yarrow", rng: Rng): { spreadId: string; spreadName: string; pieces: DrawnPiece[] } {
  const values = castLines(method, rng);
  const r = resultOf(values);
  const changingWords = r.changing.length === 0 ? "no changing lines" : `changing ${r.changing.length === 1 ? "line" : "lines"} ${r.changing.join(", ")}`;
  const pieces: DrawnPiece[] = [
    { position: 0, positionName: `The hexagram (${changingWords})`, pieceId: r.primary.id, pieceName: hexagram(r.primary.id)!.name, reversed: false },
  ];
  if (r.relating) {
    pieces.push({ position: 1, positionName: "What it changes to", pieceId: r.relating.id, pieceName: hexagram(r.relating.id)!.name, reversed: false });
  }
  return { spreadId: ichingSpreadId(method, values), spreadName: method === "coins" ? "Three coins" : "Yarrow stalks", pieces };
}

export const ICHING_LINE_WORDS = LINE_WORDS;

/** A geomancy chart is kept as "geomancy:<sixteen 1s and 2s>" in spread_id: the four Mothers it was made from. */
export function castGeomancy(rng: Rng): { spreadId: string; spreadName: string; pieces: DrawnPiece[] } {
  const mothers = castMothers(rng);
  const chart = buildChart(mothers);
  return {
    spreadId: `geomancy:${mothersToText(mothers)}`,
    spreadName: "Shield chart",
    pieces: PLACES.map((place, i) => ({
      position: i,
      positionName: PLACE_WORDS[place],
      pieceId: chart[place].id,
      pieceName: chart[place].latin,
      reversed: false,
    })),
  };
}

export function geomancyHow(position: number): string | undefined {
  const place = PLACES[position];
  if (!place) return undefined;
  return PLACE_HOW[place] === "cast" ? "Cast by chance." : `Made from ${PLACE_HOW[place]}.`;
}

