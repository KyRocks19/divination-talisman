// The counting behind the Patterns screen. Pure: rows in, plain counts out. Nothing here interprets or grades
// anything (design rule 4): it counts what the person drew and what they said afterwards about their own impressions.

import { FITS, confidenceVsFit, overallFit, type Confidence, type ConfidenceRow, type Fit } from "./guess-core";

export interface CardCount {
  pieceId: string;
  /** In how many different readings it came up. */
  readings: number;
  reversed: number;
  lastSeen: string;
}

/** Cards that came up in two or more different readings, most often first. */
export function recurringCards(rows: { reading_id: number; piece_id: string; reversed: number; created_at: string }[], min = 2): CardCount[] {
  const by = new Map<string, { readings: Set<number>; reversed: number; lastSeen: string }>();
  for (const r of rows) {
    const c = by.get(r.piece_id) ?? { readings: new Set<number>(), reversed: 0, lastSeen: r.created_at };
    if (!c.readings.has(r.reading_id)) {
      c.readings.add(r.reading_id);
      if (r.reversed) c.reversed += 1;
    }
    if (r.created_at > c.lastSeen) c.lastSeen = r.created_at;
    by.set(r.piece_id, c);
  }
  return [...by.entries()]
    .filter(([, c]) => c.readings.size >= min)
    .map(([pieceId, c]) => ({ pieceId, readings: c.readings.size, reversed: c.reversed, lastSeen: c.lastSeen }))
    .sort((a, b) => b.readings - a.readings || b.lastSeen.localeCompare(a.lastSeen) || a.pieceId.localeCompare(b.pieceId));
}

export interface SensedSummary {
  written: number;
  setAside: number;
  /** Of the written ones, how many the person has looked back on and answered how well they fitted. */
  rated: number;
  /** The person's average answer (1 to 5), or null before there are enough answers to mean something. */
  average: number | null;
  /** How many answers of each kind, for a simple bar row. */
  counts: Record<Fit, number>;
  byConfidence: ConfidenceRow[];
}

export function summariseSensed(rows: { skipped: number; confidence: Confidence | null; fit: Fit | null }[]): SensedSummary {
  const written = rows.filter((r) => !r.skipped);
  const fits = written.map((r) => r.fit).filter((f): f is Fit => f !== null);
  const counts = Object.fromEntries(FITS.map((f) => [f, 0])) as Record<Fit, number>;
  for (const f of fits) counts[f] += 1;
  return {
    written: written.length,
    setAside: rows.length - written.length,
    rated: fits.length,
    average: overallFit(fits),
    counts,
    byConfidence: confidenceVsFit(written),
  };
}
