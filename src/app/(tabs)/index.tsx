// Today: a quick way into a reading, and the readings waiting for the person to look back on what they sensed.

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../../core/cards";
import { getSettings, listReadings, PIECE_NAME_SEPARATOR, type ReadingListItem } from "../../db/queries";
import { dayText, daysSince } from "../../lib/dates";
import { ON_WEB } from "../../lib/where";
import { localDay } from "../../core/predictions";
import { duePredictions, type PredictionListItem } from "../../db/predictions";
import { PredictionCard } from "../../ui/PredictionCard";
import { Body, Button, Card, Muted, Screen, SectionLabel, Strong, Title } from "../../ui/kit";

// In a browser, Safari can clear a website's storage after 7 days without a visit, so the reminder comes sooner.
const BACKUP_DUE_DAYS = ON_WEB ? 7 : 30;

export default function Today() {
  const db = useSQLiteContext();
  const [waiting, setWaiting] = useState<ReadingListItem[]>([]);
  const [count, setCount] = useState(0);
  const [backupDays, setBackupDays] = useState<number | null>(null);
  const [hasBackup, setHasBackup] = useState(true);
  const [due, setDue] = useState<PredictionListItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const all = await listReadings(db);
        const s = await getSettings(db);
        const dueNow = await duePredictions(db, localDay(new Date()));
        if (!live) return;
        setDue(dueNow);
        setCount(all.length);
        setWaiting(all.filter((r) => r.guess && !r.skipped && r.fit === null).slice(0, 3));
        setHasBackup(!!s.lastBackupAt);
        setBackupDays(daysSince(s.lastBackupAt));
      })();
      return () => {
        live = false;
      };
    }, [db]),
  );

  const backupDue = count > 0 && (!hasBackup || (backupDays !== null && backupDays >= BACKUP_DUE_DAYS));

  return (
    <Screen>
      <Title>{dayText(new Date().toISOString())}</Title>

      <Card>
        <Strong>A card for today</Strong>
        <Muted>Write what you sense first, then turn the card over.</Muted>
        <Button label="Draw today's card" onPress={() => router.push({ pathname: "/reading/new", params: { spread: "single", daily: "1" } })} />
      </Card>

      <Card>
        <Strong>A reading</Strong>
        <Muted>Ask a question and choose a spread.</Muted>
        <Button label="Start a reading" variant="quiet" onPress={() => router.push("/reading/new")} />
      </Card>

      {due.length > 0 && (
        <>
          <SectionLabel>Predictions to look back on</SectionLabel>
          <Muted>You chose today, or a day before it, to look back on these. Say what happened when you know.</Muted>
          {due.slice(0, 5).map((p) => (
            <PredictionCard key={p.id} p={p} today={localDay(new Date())} />
          ))}
          {due.length > 5 && <Button label={`See all ${due.length}`} variant="text" onPress={() => router.push("/predictions")} />}
        </>
      )}

      {waiting.length > 0 && (
        <>
          <SectionLabel>Ready to look back on</SectionLabel>
          <Muted>You wrote what you sensed before these readings. When you know how things went, you can say how well it fitted.</Muted>
          {waiting.map((r) => {
            const first = r.tool === "tarot" ? getCardById(r.piece_ids?.split(",")[0] ?? "")?.name : r.piece_names?.split(PIECE_NAME_SEPARATOR)[0];
            return (
              <Card key={r.id} onPress={() => router.push(`/reading/${r.id}`)} accessibilityHint="Opens the reading">
                <Strong>{r.question || r.spread_name || "Reading"}</Strong>
                <Muted>
                  {dayText(r.created_at)}
                  {first ? ` · ${first}` : ""}
                </Muted>
                <Body numberOfLines={2}>You sensed: {r.guess}</Body>
              </Card>
            );
          })}
        </>
      )}

      {backupDue && (
        <Card>
          <Strong>Keep a copy</Strong>
          <Muted>
            {hasBackup
              ? `Your last backup was ${backupDays} days ago.`
              : ON_WEB
                ? "Your readings are only in this browser, and a browser can clear them. A backup file keeps them safe."
                : "Your readings are only on this phone. A backup file keeps them safe if the phone is lost."}
          </Muted>
          <Button label="Go to backups" variant="text" onPress={() => router.push("/me")} />
        </Card>
      )}
    </Screen>
  );
}
