// Blind-target practice: the person's own record of trials, with plain numbers beside what guessing alone gives.

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BLIND_WORDS, OPTION_COUNT, chanceWords, practiceNumbers, trialState } from "../../core/practice";
import { listTrials, type TrialRow } from "../../db/notes";
import { dayText } from "../../lib/dates";
import { Body, Button, Card, Loading, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";

export default function Blind() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<TrialRow[] | null>(null);
  const [more, setMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listTrials(db).then(setRows);
    }, [db]),
  );

  if (!rows) return <Loading />;
  const n = practiceNumbers(rows.map((r) => r.trial));
  const unfinished = rows.filter((r) => trialState(r.trial) !== "judged");

  return (
    <Screen>
      <Body>{BLIND_WORDS.here}</Body>
      <Button label="Start a trial" onPress={() => router.push("/blind/new")} />
      <Button label={more ? "Hide how to make it fair" : "How to make it fair"} variant="text" onPress={() => setMore(!more)} />
      {more && (
        <Card>
          <Muted>{BLIND_WORDS.blind}</Muted>
          <Muted>{BLIND_WORDS.honest}</Muted>
        </Card>
      )}

      {unfinished.length > 0 && (
        <>
          <SectionLabel>Not finished</SectionLabel>
          {unfinished.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/blind/${r.id}`)} accessibilityHint="Goes on with this trial">
              <Strong>Started {dayText(r.createdAt)}</Strong>
              <Muted>{r.trial.sealedAt ? "Impression sealed; choose which target it matches." : "Write your impression."}</Muted>
            </Card>
          ))}
        </>
      )}

      <SectionLabel>Your record</SectionLabel>
      <Card>
        {n.trials === 0 ? (
          <Muted>Finished trials are counted here.</Muted>
        ) : (
          <>
            <Body>
              {n.hits} right out of {n.trials} {n.trials === 1 ? "trial" : "trials"}.
            </Body>
            <Muted>
              Guessing alone would be right about {Math.round(n.expected * 10) / 10} times out of {n.trials} (one in {OPTION_COUNT}).
              {n.hits > 0 ? ` The chance of ${n.hits} or more right by guessing alone is ${chanceWords(n.chance)}.` : ""}
            </Muted>
          </>
        )}
      </Card>
      {rows
        .filter((r) => trialState(r.trial) === "judged")
        .map((r) => (
          <Card key={r.id} onPress={() => router.push(`/blind/${r.id}`)} accessibilityHint="Opens the trial">
            <Strong>
              {r.trial.choice === r.trial.target ? "Right" : "Not this time"}: {r.trial.options[r.trial.target]}
            </Strong>
            <Muted>{dayText(r.createdAt)}</Muted>
            <Body numberOfLines={2}>{r.impression}</Body>
          </Card>
        ))}
    </Screen>
  );
}
