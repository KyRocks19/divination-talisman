// Today: one clear way into a reading (today's card), with everything else kept quiet until the person asks for it:
// a short line for predictions that are due, and looking back and the journal folded away behind one button.

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
import { Journal } from "../../ui/Journal";
import { LookBack } from "../../ui/LookBack";
import { ReadingPicker, readingLine } from "../../ui/ReadingPicker";
import { Body, Button, Card, Muted, Screen, SectionLabel, Strong, Title } from "../../ui/kit";

// In a browser, Safari can clear a website's storage after 7 days without a visit, so the reminder comes sooner.
const BACKUP_DUE_DAYS = ON_WEB ? 7 : 30;

function dueText(n: number): string {
  return n === 1 ? "1 prediction is ready to look back on." : `${n} predictions are ready to look back on.`;
}

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
  /** Looking back and the journal stay folded away until the person opens them. */
  const [open, setOpen] = useState(false);

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
      setOpen(true);
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
        <Button label="Or start a reading with a question" variant="text" onPress={() => router.push("/reading/new")} />
      </Card>

      {due.length > 0 && (
        <Card onPress={() => router.push("/predictions")} accessibilityLabel={`${dueText(due.length)} Open predictions`}>
          <Body>{dueText(due.length)}</Body>
          <Muted>Say what happened when you know.</Muted>
        </Card>
      )}

      {!open && (
        <Card onPress={() => setOpen(true)} accessibilityLabel="Look back and journal" accessibilityHint="Opens looking back and the journal">
          <Strong>Look back and journal</Strong>
          <Muted>
            {waiting > 0
              ? `${waiting} ${waiting === 1 ? "reading is" : "readings are"} ready to look back on.`
              : "Write about a reading, or in your own journal."}
          </Muted>
        </Card>
      )}

      {open && (
        <>
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
          <Button label="Fold away" variant="text" onPress={() => setOpen(false)} />
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
