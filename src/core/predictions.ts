// Predictions: what the person expects to happen after a reading, written down at the time and looked back on later.
// The words, the look-back dates and the reminder plan. Pure: no database, no phone, so the tests can run it.
//
// The words first written are sealed (`original_text` never changes); the person can reword it until they look back.
// What happened is the person's own judgement. Nothing here grades it: the counts are plain counts.

export const MAX_PREDICTION_LENGTH = 2000;

export const OUTCOMES = ["yes", "partly", "no", "unclear"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** The same words as the desktop app, so an imported prediction reads the same. */
export const OUTCOME_LABELS: Record<Outcome, string> = {
  yes: "It came true",
  partly: "Partly",
  no: "It did not",
  unclear: "Can't tell, or it never came up",
};

export function isOutcome(v: unknown): v is Outcome {
  return typeof v === "string" && (OUTCOMES as readonly string[]).includes(v);
}

/** The choices for when to look back. `null` is "no date": it waits in the list with no reminder. */
export const LOOK_BACK_CHOICES: { days: number | null; label: string }[] = [
  { days: 3, label: "In 3 days" },
  { days: 7, label: "In a week" },
  { days: 14, label: "In 2 weeks" },
  { days: 30, label: "In a month" },
  { days: 91, label: "In 3 months" },
  { days: null, label: "No date" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-06" for the given moment, in the phone's own time. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day `days` after `from`, in the phone's own time. */
export function dayAfter(from: Date, days: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return localDay(d);
}

/** A "YYYY-MM-DD" text, or null when it is not one. */
export function cleanDay(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim().slice(0, 10));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** "6 November 2026" for a "YYYY-MM-DD" day, read as the phone's own calendar day (never shifted by time zone). */
export function dayWords(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function cleanPredictionText(value: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, error: "Write what you expect to happen." };
  if (text.length > MAX_PREDICTION_LENGTH) return { ok: false, error: `That is too long (${MAX_PREDICTION_LENGTH} characters at most).` };
  return { ok: true, text };
}

export interface PredictionLike {
  id: number;
  look_back_on: string | null;
  outcome: string | null;
}

export type PredictionState = "due" | "waiting" | "no-date" | "looked-back";

/** Where a prediction stands on `today` ("YYYY-MM-DD"). */
export function predictionState(p: PredictionLike, today: string): PredictionState {
  if (p.outcome) return "looked-back";
  if (!p.look_back_on) return "no-date";
  return p.look_back_on <= today ? "due" : "waiting";
}

export interface PredictionCounts {
  total: number;
  due: number;
  waiting: number;
  noDate: number;
  outcomes: Record<Outcome, number>;
}

export function countPredictions(rows: PredictionLike[], today: string): PredictionCounts {
  const out: PredictionCounts = { total: rows.length, due: 0, waiting: 0, noDate: 0, outcomes: { yes: 0, partly: 0, no: 0, unclear: 0 } };
  for (const p of rows) {
    const s = predictionState(p, today);
    if (s === "due") out.due += 1;
    else if (s === "waiting") out.waiting += 1;
    else if (s === "no-date") out.noDate += 1;
    else if (isOutcome(p.outcome)) out.outcomes[p.outcome] += 1;
  }
  return out;
}

// ── Reminders on the phone ──────────────────────────────────────────────────────────────────────────

/** The hour of the day reminders come, in the phone's own time. */
export const REMINDER_HOUR = 9;
/** How many days after the last backup the backup reminder comes. */
export const BACKUP_REMINDER_DAYS = 30;
/** Phones keep a limited number of scheduled reminders (iPhones 64), so only the soonest are set. */
export const MAX_REMINDERS = 50;

export interface PlannedReminder {
  /** Stable, so a reminder can be found again: "prediction-12" or "backup". */
  key: string;
  at: Date;
  title: string;
  body: string;
  /** The screen a tap on it opens. */
  url: string;
}

/** The moment a reminder for a "YYYY-MM-DD" day comes. */
export function reminderMoment(day: string, hour = REMINDER_HOUR): Date | null {
  const clean = cleanDay(day);
  if (!clean) return null;
  const [y, m, d] = clean.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

/**
 * Every reminder the phone should hold, soonest first. The words never quote the prediction or the question: a reminder
 * can show on a locked screen, where anyone nearby can read it.
 */
export function planReminders(input: {
  predictions: PredictionLike[];
  lookBack: boolean;
  backup: boolean;
  lastBackupAt: string | null;
  hasReadings: boolean;
  now: Date;
}): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  if (input.lookBack) {
    // One reminder per day, however many predictions fall on it.
    const byDay = new Map<string, number[]>();
    for (const p of input.predictions) {
      if (p.outcome || !p.look_back_on) continue;
      const day = cleanDay(p.look_back_on);
      if (!day) continue;
      byDay.set(day, [...(byDay.get(day) ?? []), p.id]);
    }
    for (const [day, ids] of byDay) {
      const at = reminderMoment(day);
      if (!at || at.getTime() <= input.now.getTime()) continue;
      out.push({
        key: `look-back-${day}`,
        at,
        title: ids.length === 1 ? "A prediction to look back on" : `${ids.length} predictions to look back on`,
        body: "You asked to look back today. Open the app to say what happened.",
        url: ids.length === 1 ? `/prediction/${ids[0]}` : "/predictions",
      });
    }
  }
  if (input.backup && input.hasReadings) {
    const from = input.lastBackupAt ? new Date(input.lastBackupAt) : input.now;
    if (!Number.isNaN(from.getTime())) {
      let at = reminderMoment(dayAfter(from, BACKUP_REMINDER_DAYS), 10)!;
      // Already overdue: the Today screen says so; remind again tomorrow rather than never.
      if (at.getTime() <= input.now.getTime()) at = reminderMoment(dayAfter(input.now, 1), 10)!;
      out.push({
        key: "backup",
        at,
        title: "Time to make a backup",
        body: input.lastBackupAt
          ? `Your last backup file was made ${BACKUP_REMINDER_DAYS} or more days ago. A new one keeps your readings safe.`
          : "You have not made a backup file yet. One keeps your readings safe if the phone is lost.",
        url: "/me",
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS);
}
