// The browser version cannot show reminders when the page is closed, so it has none. The Today screen lists what is
// due instead. Same exports as reminders.ts.

import type { Db } from "../db/types";

export const REMINDERS_AVAILABLE = false;

export type ReminderPermission = "granted" | "denied" | "undetermined";

export function setUpReminders(): void {}

export async function reminderPermission(): Promise<ReminderPermission> {
  return "denied";
}

export async function syncReminders(_db: Db, _opts: { ask?: boolean } = {}): Promise<boolean> {
  return false;
}

export function useReminderTaps(_open: (url: string) => void): void {}
