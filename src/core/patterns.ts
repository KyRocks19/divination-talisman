// The counting behind the Patterns screen. Pure: rows in, plain counts out. Nothing here interprets or grades
// anything (design rule 4): it counts what the person drew and what they said afterwards about their own impressions.

import { FITS, confidenceVsFit, overallFit, type Confidence, type ConfidenceRow, type Fit } from "./guess-core";

export interface CardCount {
  tool: string;
  pieceId: string;
  /** The name it had the last time it came up. */
  name: string | null;
  /** In how many different readings it came up. */
  readings: number;
  reversed: number;
  lastSeen: string;
}

/** Cards that came up in two or more different readings, most often first. A tarot card and an oracle card never mix. */
export function recurringCards(
  rows: { reading_id: number; tool?: string; piece_id: string; piece_name?: string | null; reversed: number; created_at: string }[],
  min = 2,
): CardCount[] {
  const by = new Map<string, { tool: string; pieceId: string; name: string | null; readings: Set<number>; reversed: number; lastSeen: string }>();
  for (const r of rows) {
    const tool = r.tool ?? "tarot";
    const key = `${tool}:${r.piece_id}`;
    const c = by.get(key) ?? { tool, pieceId: r.piece_id, name: null, readings: new Set<number>(), reversed: 0, lastSeen: r.created_at };
    if (!c.readings.has(r.reading_id)) {
      c.readings.add(r.reading_id);
      if (r.reversed) c.reversed += 1;
    }
    if (r.created_at >= c.lastSeen) {
      c.lastSeen = r.created_at;
      if (r.piece_name) c.name = r.piece_name;
    } else if (!c.name && r.piece_name) c.name = r.piece_name;
    by.set(key, c);
  }
  return [...by.values()]
    .filter((c) => c.readings.size >= min)
    .map((c) => ({ tool: c.tool, pieceId: c.pieceId, name: c.name, readings: c.readings.size, reversed: c.reversed, lastSeen: c.lastSeen }))
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
