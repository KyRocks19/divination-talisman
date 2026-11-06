// Today: a quick way into a reading, the predictions due, and looking back and the journal for any reading the person
// chooses (or their own journal, about no reading).

import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { defaultChoice, lookBackState, readingTitle } from "../../core/look-back";
import { getReading, getSettings, listReadings, type FullReading, type ReadingListItem } from "../../db/queries";
import { dayText, dayTimeText, daysSince } from "../../lib/dates";
import { ON_WEB } from "../../lib/where";
import { localDay } from "../../core/predictions";
import { duePredictions, type PredictionListItem } from "../../db/predictions";
import { CONFIDENCE_LABELS } from "../../core/guess-core";
import { PredictionCard } from "../../ui/PredictionCard";
import { Journal } from "../../ui/Journal";
import { LookBack } from "../../ui/LookBack";
import { ReadingPicker, readingLine } from "../../ui/ReadingPicker";
import { Body, Button, Card, Muted, Screen, SectionLabel, Strong, Title } from "../../ui/kit";

// In a browser, Safari can clear a website's storage after 7 days without a visit, so the reminder comes sooner.
const BACKUP_DUE_DAYS = ON_WEB ? 7 : 30;

export default function Today() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ reading?: string }>();
  const [readings, setReadings] = useState<ReadingListItem[]>([]);
  const [backupDays, setBackupDays] = useState<number | null>(null);
  const [hasBackup, setHasBackup] = useState(true);
  const [due, setDue] = useState<PredictionListItem[]>([]);
  /** The reading chosen to look back on and write about; null for the person's own journal; undefined before loading. */
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  const [chosenData, setChosenData] = useState<FullReading | null>(null);
  const [picking, setPicking] = useState(false);

  const loadChosen = useCallback(async (id: number | null) => setChosenData(id === null ? null : await getReading(db, id)), [db]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const all = await listReadings(db);
        const s = await getSettings(db);
        const dueNow = await duePredictions(db, localDay(new Date()));
        if (!live) return;
        setDue(dueNow);
        setReadings(all);
        setHasBackup(!!s.lastBackupAt);
        setBackupDays(daysSince(s.lastBackupAt));
        // Keep the person's choice while they come and go, unless that reading has been deleted.
        setChosen((old) => (old === undefined || (old !== null && !all.some((r) => r.id === old)) ? defaultChoice(all) : old));
      })();
      return () => {
        live = false;
      };
    }, [db]),
  );

  // "Look back on Today" on a reading opens this tab with that reading chosen.
  useEffect(() => {
    if (params.reading) {
      setChosen(Number(params.reading));
      router.setParams({ reading: undefined });
    }
  }, [params.reading]);

  useEffect(() => {
    if (chosen !== undefined) loadChosen(chosen);
  }, [chosen, loadChosen]);

  const count = readings.length;
  const waiting = readings.filter((r) => lookBackState(r) === "waiting").length;
  const backupDue = count > 0 && (!hasBackup || (backupDays !== null && backupDays >= BACKUP_DUE_DAYS));
  const listed = readings.find((r) => r.id === chosen);
  const sensed = chosenData?.sensed && !chosenData.sensed.skipped ? chosenData.sensed : null;
  const about = chosenData ? readingTitle(chosenData.reading) : null;

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

      <SectionLabel>Look back and journal</SectionLabel>
      <Card>
        <Muted>
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? "reading is" : "readings are"} ready to look back on. You can choose any reading here, or your own journal.`
            : "Choose any reading to look back on and write about, or your own journal."}
        </Muted>
        {chosen !== undefined && (
          <>
            <Strong>{chosenData ? about : "My own journal"}</Strong>
            {chosenData && <Muted>{listed ? readingLine(listed) : dayText(chosenData.reading.created_at)}</Muted>}
          </>
        )}
        <Button label={chosenData ? "Choose another reading" : "Choose a reading"} variant="quiet" onPress={() => setPicking(true)} />
        {chosenData && <Button label="Open the reading" variant="text" onPress={() => router.push(`/reading/${chosenData.reading.id}`)} />}
      </Card>

      {chosenData && sensed && (
        <Card>
          <SectionLabel>What you sensed first</SectionLabel>
          <Body>{sensed.guess}</Body>
          <Muted>
            Sealed {dayTimeText(sensed.sealed_at)}
            {sensed.confidence ? ` · ${CONFIDENCE_LABELS[sensed.confidence]}` : ""}
          </Muted>
        </Card>
      )}
      {chosenData && sensed && (
        <LookBack key={`look-back-${chosenData.reading.id}`} readingId={chosenData.reading.id} fit={sensed.fit} note={sensed.fit_note} onSaved={() => loadChosen(chosenData.reading.id)} />
      )}
      {chosenData && !sensed && (
        <Muted>You did not write what you sensed first for this reading, so there is nothing to look back on. You can still write about it in the journal.</Muted>
      )}
      {chosen !== undefined && <Journal key={`journal-${chosen}`} readingId={chosen} about={about} />}

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

      <ReadingPicker
        visible={picking}
        chosen={chosen ?? null}
        onChoose={(id) => {
          setChosen(id);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}
