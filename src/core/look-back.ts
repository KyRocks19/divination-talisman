// Choosing a reading to look back on, on the Today tab. Plain functions over the rows listReadings gives.

import { getCardById } from "./cards";
import { toolName } from "./tools";

export interface LookBackRow {
  id: number;
  tool: string;
  question: string;
  spread_name: string | null;
  piece_ids: string | null;
  piece_names: string | null;
  guess: string | null;
  skipped: number | null;
  fit: number | null;
}

/** "waiting": the person wrote what they sensed and has not looked back yet. "looked-back": they have.
 *  "nothing-sensed": they skipped it or it was off, so there is nothing to compare; the journal still works. */
export type LookBackState = "waiting" | "looked-back" | "nothing-sensed";

export function lookBackState(r: LookBackRow): LookBackState {
  if (!r.guess || r.skipped) return "nothing-sensed";
  return r.fit === null ? "waiting" : "looked-back";
}

/** The reading's name in a list: its question, or its spread or tool. */
export function readingTitle(r: Pick<LookBackRow, "question" | "spread_name" | "tool">): string {
  return r.question.trim() || r.spread_name || toolName(r.tool) || "Reading";
}

/** The first card or piece drawn, by name. */
export function firstPiece(r: Pick<LookBackRow, "tool" | "piece_ids" | "piece_names">, separator: string): string | null {
  if (r.tool === "tarot") return getCardById(r.piece_ids?.split(",")[0] ?? "")?.name ?? null;
  return r.piece_names?.split(separator)[0] || null;
}

/** What Today chooses before the person does: the newest reading waiting to be looked back on, or else the newest reading,
 *  or else the person's own journal (null). */
export function defaultChoice(rows: LookBackRow[]): number | null {
  return (rows.find((r) => lookBackState(r) === "waiting") ?? rows[0])?.id ?? null;
}

/** The picker's list: readings waiting to be looked back on first, then the rest, each newest first. */
export function pickerGroups<T extends LookBackRow>(rows: T[]): { waiting: T[]; others: T[] } {
  return { waiting: rows.filter((r) => lookBackState(r) === "waiting"), others: rows.filter((r) => lookBackState(r) !== "waiting") };
}
