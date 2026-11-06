// Bringing writing over from the desktop app. The file is the JSON that Divination Station's Settings export makes
// ("Download my data as JSON", divination-station-YYYY-MM-DD.json). This file reads and checks it and works out what
// to add; src/db/desktop-import.ts writes it. Pure, so the tests can run it.
//
// An import only ever ADDS. A reading, meaning or prediction the phone already has is skipped, and nothing on the
// phone is changed or deleted. Nothing in the file is trusted: every row is checked as if a stranger had typed it.

import { getCardById } from "./cards";
import { cleanDay, isOutcome, type Outcome } from "./predictions";

export const DESKTOP_LIMITS = {
  bytes: 30_000_000,
  readings: 5000,
  journalsPerReading: 500,
  rows: 5000,
  text: 20_000,
  short: 2000,
  tag: 40,
} as const;

type Row = Record<string, unknown>;

export interface ImportPiece {
  position: number;
  positionName: string;
  pieceId: string;
  pieceName: string;
  reversed: boolean;
}

export interface ImportReading {
  /** Same reading on the phone already: same moment and the same cards in order. */
  key: string;
  createdAt: string;
  question: string;
  spreadName: string | null;
  notes: string;
  pieces: ImportPiece[];
  tags: string[];
  journals: { createdAt: string; body: string }[];
}

export interface ImportMeaning {
  pieceId: string;
  orientation: "upright" | "reversed";
  /** Oldest first; the last is the desktop's current meaning. */
  versions: { text: string; savedAt: string }[];
}

export interface ImportPrediction {
  key: string;
  createdAt: string;
  firstWords: string;
  words: string;
  lookBackOn: string | null;
  outcome: Outcome | null;
  outcomeNote: string | null;
  lookedBackAt: string | null;
}

export interface DesktopImport {
  exportedAt: string | null;
  readings: ImportReading[];
  meanings: ImportMeaning[];
  predictions: ImportPrediction[];
  /** Every tag name in the file, including ones on no reading. */
  tags: string[];
  /** Rows that could not be read and were left out, by part. */
  leftOut: { readings: number; journals: number; meanings: number; predictions: number };
  /** Parts of the file that are not brought in, in plain words, for the report. */
  notBrought: string[];
}

export type CheckedDesktop = { ok: true; data: DesktopImport } | { ok: false; error: string };

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
};

/** A moment as ISO text, or null. */
function moment(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const readingKey = (createdAt: string, pieceIds: string[]) => `${new Date(createdAt).toISOString()}|${pieceIds.join(",")}`;

function cleanCard(raw: unknown, position: number, positionName: string): ImportPiece | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const card = typeof r.card_id === "string" ? getCardById(r.card_id) : undefined;
  if (!card) return null;
  return {
    position,
    positionName: str(r.position, 200) ?? positionName,
    pieceId: card.id,
    pieceName: card.name,
    reversed: r.reversed === true,
  };
}

function cleanReading(raw: unknown, leftOut: DesktopImport["leftOut"]): ImportReading | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const createdAt = moment(r.created_at);
  if (!createdAt || !Array.isArray(r.cards) || r.cards.length === 0 || r.cards.length > 100) return null;
  const pieces: ImportPiece[] = [];
  for (const [i, c] of r.cards.entries()) {
    const p = cleanCard(c, i, `Card ${i + 1}`);
    if (!p) return null;
    pieces.push(p);
  }
  // Clarifiers come after the main cards, named for the card they clarify.
  if (r.clarifiers && typeof r.clarifiers === "object") {
    for (const [idx, list] of Object.entries(r.clarifiers as Row)) {
      const of = pieces[Number(idx)];
      if (!of || !Array.isArray(list)) continue;
      for (const c of list.slice(0, 10)) {
        const p = cleanCard(c, pieces.length, `Clarifier for ${of.positionName}`);
        if (p) pieces.push({ ...p, positionName: `Clarifier for ${of.positionName}` });
      }
    }
  }
  const title = str(r.title, DESKTOP_LIMITS.short);
  const question = str(r.question, DESKTOP_LIMITS.short);
  const notes = str(r.notes, DESKTOP_LIMITS.text) ?? "";
  const journals: ImportReading["journals"] = [];
  if (Array.isArray(r.journals)) {
    for (const j of r.journals.slice(0, DESKTOP_LIMITS.journalsPerReading)) {
      const jr = (j ?? {}) as Row;
      // Only the person's own entries: the phone app has no AI, and the person is the only author here.
      if (jr.author !== "user") continue;
      const body = str(jr.content, DESKTOP_LIMITS.text);
      const at = moment(jr.created_at);
      if (!body || !at) {
        leftOut.journals += 1;
        continue;
      }
      journals.push({ createdAt: at, body });
    }
  }
  const tags = Array.isArray(r.tags)
    ? [...new Set(r.tags.map((t) => str(typeof t === "string" ? t.replace(/\s+/g, " ") : t, DESKTOP_LIMITS.tag)).filter((t): t is string => !!t))]
    : [];
  return {
    key: readingKey(createdAt, pieces.map((p) => p.pieceId)),
    createdAt,
    // The phone has one line for a reading's name: the question, or the desktop's title when there is no question.
    question: question ?? title ?? "",
    spreadName: str(r.spread_name, 200),
    notes: title && question && title !== question ? (notes ? `${title}\n\n${notes}` : title) : notes,
    pieces,
    tags,
    journals,
  };
}

/** The desktop keeps keywords and a description apart; the phone has one text. */
function meaningText(fields: unknown, side: "upright" | "reversed"): string | null {
  if (!fields || typeof fields !== "object") return null;
  const f = fields as Row;
  const parts = [str(f[`${side}Keywords`], DESKTOP_LIMITS.text), str(f[`${side}Description`], DESKTOP_LIMITS.text)].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

function cleanMeanings(raw: unknown): { meanings: ImportMeaning[]; leftOut: number } {
  const out: ImportMeaning[] = [];
  let leftOut = 0;
  if (!Array.isArray(raw)) return { meanings: out, leftOut };
  for (const m of raw.slice(0, DESKTOP_LIMITS.rows)) {
    const r = (m ?? {}) as Row;
    const card = typeof r.card_id === "string" ? getCardById(r.card_id) : undefined;
    if (!card) {
      leftOut += 1;
      continue;
    }
    for (const side of ["upright", "reversed"] as const) {
      const versions: ImportMeaning["versions"] = [];
      const history = Array.isArray(r.history) ? r.history : [];
      for (const h of history) {
        const text = meaningText(h, side);
        const at = moment((h as Row)?.saved_at);
        if (text && at && versions[versions.length - 1]?.text !== text) versions.push({ text, savedAt: at });
      }
      const current = meaningText(r.current, side);
      if (current && versions[versions.length - 1]?.text !== current) {
        versions.push({ text: current, savedAt: moment(r.updated_at) ?? versions[versions.length - 1]?.savedAt ?? new Date(0).toISOString() });
      }
      if (versions.length) out.push({ pieceId: card.id, orientation: side, versions });
    }
  }
  return { meanings: out, leftOut };
}

function cleanPredictions(raw: unknown): { predictions: ImportPrediction[]; leftOut: number } {
  const out: ImportPrediction[] = [];
  let leftOut = 0;
  if (!Array.isArray(raw)) return { predictions: out, leftOut };
  for (const p of raw.slice(0, DESKTOP_LIMITS.rows)) {
    const r = (p ?? {}) as Row;
    const createdAt = moment(r.written_at);
    const first = str(r.first_words, DESKTOP_LIMITS.short);
    const words = str(r.current_words, DESKTOP_LIMITS.short) ?? first;
    if (!createdAt || !first || !words) {
      leftOut += 1;
      continue;
    }
    const outcome = isOutcome(r.what_happened) ? r.what_happened : null;
    out.push({
      key: `${createdAt}|${first}`,
      createdAt,
      firstWords: first,
      words,
      lookBackOn: cleanDay(r.look_back_on),
      outcome,
      outcomeNote: outcome ? str(r.in_your_words, DESKTOP_LIMITS.short) : null,
      lookedBackAt: outcome ? (moment(r.looked_back_at) ?? createdAt) : null,
    });
  }
  return { predictions: out, leftOut };
}

const HANDLED = new Set(["exported_at", "readings", "card_meanings", "tags", "predictions"]);
const SAID: Record<string, string> = {
  account: "your account name",
  preferences: "your settings",
  colours: "your colours",
  oracle_decks: "oracle decks (their pictures are not in the file; make them again here)",
  other_tool_readings: "readings from tools other than tarot",
  first_guesses: "first impressions (the file does not say which reading each belongs to)",
  layouts: "your own layouts",
  companion_questions: "what the AI companion wrote",
  concept_notes: "notes on concepts",
  synthesis_journals: "synthesis journals",
  days: "day entries",
  circle: "circle membership",
};

/** Reads the file's text and says, in plain words, why it cannot be used when it cannot. Nothing is written. */
export function checkDesktopExport(text: string): CheckedDesktop {
  if (text.length > DESKTOP_LIMITS.bytes) return { ok: false, error: "This file is too large to bring in." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file could not be read. Choose the JSON file from the desktop app's Settings, Export." };
  }
  const d = data as Row | null;
  if (!d || typeof d !== "object" || Array.isArray(d) || (!("readings" in d) && !("card_meanings" in d))) {
    if (d && typeof d === "object" && (d as Row).format === "divination-talisman-backup-1") {
      return { ok: false, error: "This is a backup from this app. Use \"Restore from a backup file\" instead." };
    }
    return { ok: false, error: "This is not an export from Divination Station. In the desktop app, open Settings and download your data as JSON." };
  }
  const leftOut = { readings: 0, journals: 0, meanings: 0, predictions: 0 };
  const readings: ImportReading[] = [];
  const raw = Array.isArray(d.readings) ? d.readings : [];
  if (raw.length > DESKTOP_LIMITS.readings) return { ok: false, error: `This file has more than ${DESKTOP_LIMITS.readings} readings.` };
  const seen = new Set<string>();
  for (const r of raw) {
    const clean = cleanReading(r, leftOut);
    if (!clean) leftOut.readings += 1;
    else if (!seen.has(clean.key)) {
      seen.add(clean.key);
      readings.push(clean);
    }
  }
  const m = cleanMeanings(d.card_meanings);
  leftOut.meanings = m.leftOut;
  const p = cleanPredictions(d.predictions);
  leftOut.predictions = p.leftOut;
  const notBrought = Object.keys(d)
    .filter((k) => !HANDLED.has(k))
    .filter((k) => {
      const v = d[k];
      return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && !(typeof v === "object" && Object.keys(v as object).length === 0);
    })
    .map((k) => SAID[k] ?? k.replace(/_/g, " "));
  const tagNames = new Map<string, string>();
  const addTag = (t: unknown) => {
    const name = str(typeof t === "string" ? t.replace(/\s+/g, " ") : t, DESKTOP_LIMITS.tag);
    if (name && !tagNames.has(name.toLowerCase())) tagNames.set(name.toLowerCase(), name);
  };
  if (Array.isArray(d.tags)) for (const t of d.tags.slice(0, DESKTOP_LIMITS.rows)) addTag((t as Row)?.name);
  for (const r of readings) r.tags.forEach(addTag);
  return {
    ok: true,
    data: { exportedAt: moment(d.exported_at), readings, meanings: m.meanings, predictions: p.predictions, tags: [...tagNames.values()], leftOut, notBrought },
  };
}

export interface ImportReport {
  readings: { added: number; had: number };
  meanings: { added: number; had: number };
  predictions: { added: number; had: number };
  journals: number;
  tags: number;
}

/** The report in plain words, one line each. */
export function reportLines(r: ImportReport, d: DesktopImport): string[] {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const lines = [
    `${n(r.readings.added, "tarot reading", "tarot readings")} added${r.readings.had ? `, ${r.readings.had} already here` : ""}.`,
    `${n(r.journals, "journal entry", "journal entries")} and ${n(r.tags, "tag", "tags")} on them.`,
    `${n(r.meanings.added, "card meaning", "card meanings")} added${r.meanings.had ? `, ${r.meanings.had} already here` : ""}.`,
    `${n(r.predictions.added, "prediction", "predictions")} added${r.predictions.had ? `, ${r.predictions.had} already here` : ""}.`,
  ];
  const bad = d.leftOut.readings + d.leftOut.journals + d.leftOut.meanings + d.leftOut.predictions;
  if (bad) lines.push(`${n(bad, "item", "items")} could not be read and ${bad === 1 ? "was" : "were"} left out.`);
  if (d.notBrought.length) lines.push(`Not brought in: ${d.notBrought.join("; ")}.`);
  return lines;
}
