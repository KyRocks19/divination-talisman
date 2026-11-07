// Signs and dreams, and blind-target practice: the words, limits and arithmetic. Pure, so the tests can run it.
// Both are kept in the `notes` table (kind "sign", "dream" or "blind"), not as readings: the app draws nothing for a
// sign or a dream, and a blind-target trial is practice, not a reading.
//
// From the desktop app's lib/signs-core.ts and lib/remoteview-core.ts.

// ── Signs and dreams ────────────────────────────────────────────────────────────────────────────────

import { cleanRandomUsed, type RandomUsed } from "./random-source";
export type NoteKind = "sign" | "dream";
export const NOTE_KINDS: NoteKind[] = ["sign", "dream"];
export const MAX_NOTE_CHARS = 5000;

export const NOTE_WORDS: Record<NoteKind, { label: string; plural: string; prompt: string }> = {
  sign: { label: "A sign", plural: "Signs", prompt: "What did you notice, and where were you?" },
  dream: { label: "A dream", plural: "Dreams", prompt: "What do you remember of the dream?" },
};

export function isNoteKind(v: unknown): v is NoteKind {
  return v === "sign" || v === "dream";
}

export function cleanNoteBody(v: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return { ok: false, error: "Write a few words first." };
  if (t.length > MAX_NOTE_CHARS) return { ok: false, error: `That is too long (${MAX_NOTE_CHARS} characters at most).` };
  return { ok: true, text: t };
}

export const SIGN_WORDS =
  "Write down a sign you noticed or a dream you had. The app gives no meaning to either. Later you can come back, add what followed, and see them side by side.";

// ── Blind-target practice ───────────────────────────────────────────────────────────────────────────

export const OPTION_COUNT = 4;
export const MAX_OPTION_CHARS = 80;
export const MAX_IMPRESSION_CHARS = 5000;

/** Four different targets, each trimmed and 1 to MAX_OPTION_CHARS long, or a plain reason why not. "Different" ignores case and spaces. */
export function cleanOptions(v: string[]): { ok: true; options: string[] } | { ok: false; error: string } {
  if (v.length !== OPTION_COUNT) return { ok: false, error: `Write ${OPTION_COUNT} targets.` };
  const out = v.map((x) => x.replace(/\s+/g, " ").trim());
  if (out.some((x) => !x)) return { ok: false, error: `Write all ${OPTION_COUNT} targets.` };
  if (out.some((x) => x.length > MAX_OPTION_CHARS)) return { ok: false, error: `Each target can be up to ${MAX_OPTION_CHARS} characters.` };
  if (new Set(out.map((x) => x.toLowerCase())).size !== OPTION_COUNT) return { ok: false, error: "The four targets need to be different." };
  return { ok: true, options: out };
}

/** Which of the options is the target, each equally likely. */
export function pickTarget(rng: () => number): number {
  return Math.min(OPTION_COUNT - 1, Math.floor(rng() * OPTION_COUNT));
}

/** The chance of `hits` or more right choices out of `trials` by guessing alone, each right with chance `p`. Exact binomial terms. */
export function chanceOfAtLeast(hits: number, trials: number, p = 1 / OPTION_COUNT): number {
  if (trials <= 0 || hits <= 0) return 1;
  if (hits > trials) return 0;
  let term = Math.pow(1 - p, trials);
  let sum = 0;
  for (let k = 1; k <= trials; k++) {
    term = (term * (trials - k + 1) * p) / (k * (1 - p));
    if (k >= hits) sum += term;
  }
  return Math.min(1, sum);
}

/** A chance as words: "about 1 in 5" or "under 1 in 1,000". */
export function chanceWords(c: number): string {
  if (c >= 0.95) return "almost certain";
  if (c <= 0) return "none";
  const inN = 1 / c;
  if (inN > 1000) return "under 1 in 1,000";
  return `about 1 in ${Math.round(inN).toLocaleString("en-US")}`;
}

export interface Trial {
  options: string[];
  target: number;
  /** When the impression was sealed; null while it is still being written. */
  sealedAt: string | null;
  choice: number | null;
  judgedAt: string | null;
  /** Where the chance that picked the target came from; missing on trials made before this was kept. */
  randomSource?: RandomUsed | null;
}

export type TrialState = "open" | "sealed" | "judged";

export function trialState(t: Trial): TrialState {
  if (t.choice !== null && t.judgedAt) return "judged";
  return t.sealedAt ? "sealed" : "open";
}

/** A trial from a note's `extra` JSON, or null when it is damaged. */
export function parseTrial(extra: string): Trial | null {
  try {
    const t = JSON.parse(extra) as Partial<Trial>;
    if (!Array.isArray(t.options) || t.options.length !== OPTION_COUNT || typeof t.target !== "number") return null;
    if (t.target < 0 || t.target >= OPTION_COUNT) return null;
    return {
      options: t.options.map(String),
      target: t.target,
      sealedAt: typeof t.sealedAt === "string" ? t.sealedAt : null,
      choice: typeof t.choice === "number" && t.choice >= 0 && t.choice < OPTION_COUNT ? t.choice : null,
      judgedAt: typeof t.judgedAt === "string" ? t.judgedAt : null,
      randomSource: cleanRandomUsed(t.randomSource),
    };
  } catch {
    return null;
  }
}

export function practiceNumbers(trials: Trial[]) {
  const judged = trials.filter((t) => trialState(t) === "judged");
  const hits = judged.filter((t) => t.choice === t.target).length;
  return { trials: judged.length, hits, expected: judged.length / OPTION_COUNT, chance: chanceOfAtLeast(hits, judged.length) };
}

export const BLIND_WORDS = {
  here: "Practise writing down first impressions of something you cannot see. Four possible targets are written, and the app picks one by chance and keeps it hidden. You write your impression and it is sealed, then you choose which of the four it matches best, and only then is the target shown.",
  blind: "For a fair test, someone else should write the four targets, so you do not know them: hand them the phone, and they press \"Hide them\" before handing it back. If you write them yourself you will know the options, and your impression may be shaped by them. It is a weaker test, but you can still keep a record.",
  honest: "With four options, choosing at random is right a quarter of the time. Your own results are shown next to that. A few trials cannot show much either way. The app does not claim that anyone can or cannot do better than chance.",
};
