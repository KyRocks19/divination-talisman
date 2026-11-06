// Reminders the phone shows by itself: a prediction's look-back day, and a backup every 30 days. They are scheduled
// on the phone with no server and no push service; nothing is sent anywhere. The plan is worked out in
// src/core/predictions.ts; this file only hands it to the phone, replacing whatever was set before.

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { planReminders } from "../core/predictions";
import { listPredictions } from "../db/predictions";
import { getSettings } from "../db/queries";
import type { Db } from "../db/types";

export const REMINDERS_AVAILABLE = true;

const CHANNEL = "reminders";
let channelMade = false;

/** Reminders show while the app is open too, quietly. */
export function setUpReminders(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensureChannel(): Promise<void> {
  if (channelMade || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Reminders",
    description: "Look-back days for your predictions, and backups.",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelMade = true;
}

export type ReminderPermission = "granted" | "denied" | "undetermined";

export async function reminderPermission(): Promise<ReminderPermission> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

/**
 * Sets the phone's reminders to match the readings and settings. With `ask`, the phone's permission prompt may show
 * (only when there is something to remind about); without it, nothing is asked. Returns whether reminders can show.
 */
export async function syncReminders(db: Db, { ask = false }: { ask?: boolean } = {}): Promise<boolean> {
  try {
    const s = await getSettings(db);
    const count = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM readings", []);
    const plan = planReminders({
      predictions: await listPredictions(db),
      lookBack: s.lookBackReminders,
      backup: s.backupReminders,
      lastBackupAt: s.lastBackupAt,
      hasReadings: (count?.n ?? 0) > 0,
      now: new Date(),
    });
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (plan.length === 0) return true;
    let perm = await reminderPermission();
    if (perm === "undetermined" && ask) {
      const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
      perm = asked.granted ? "granted" : "denied";
    }
    if (perm !== "granted") return false;
    await ensureChannel();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.key,
        content: { title: r.title, body: r.body, data: { url: r.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
    return true;
  } catch {
    // Reminders are a help, never a reason for a save to fail.
    return false;
  }
}

/** The screen a tapped reminder asks to open, while the app runs or when it opened the app. */
export function useReminderTaps(open: (url: string) => void): void {
  const last = Notifications.useLastNotificationResponse();
  const url = last?.notification.request.content.data?.url;
  // The same reminder id comes back each month ("backup"), so a tap is told apart by its time too.
  const id = last ? `${last.notification.request.identifier}:${last.notification.date}` : null;
  useOpenOnce(typeof url === "string" ? url : null, id, open);
}

function useOpenOnce(url: string | null, id: string | null, open: (url: string) => void) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!url || !id || seen.current === id) return;
    seen.current = id;
    open(url);
  }, [url, id, open]);
}
