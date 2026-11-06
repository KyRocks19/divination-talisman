// Every prediction: the ones ready to look back on, the ones waiting for their day, and the ones looked back on.

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { localDay, predictionState, type PredictionState } from "../core/predictions";
import { listPredictions, type PredictionListItem } from "../db/predictions";
import { Button, Card, Loading, Muted, Screen, SectionLabel, Strong } from "../ui/kit";
import { PredictionCard } from "../ui/PredictionCard";

const GROUPS: { state: PredictionState; label: string }[] = [
  { state: "due", label: "Ready to look back on" },
  { state: "waiting", label: "Waiting for their day" },
  { state: "no-date", label: "No date" },
  { state: "looked-back", label: "Looked back on" },
];

export default function Predictions() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<PredictionListItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listPredictions(db).then(setRows);
    }, [db]),
  );

  if (!rows) return <Loading />;
  const today = localDay(new Date());

  return (
    <Screen>
      <Muted>
        After a reading, write what you expect to happen and choose a day to look back. Saying afterwards what happened shows you, over time,
        how your sense of things works.
      </Muted>
      <Button label="Write a prediction" variant="quiet" onPress={() => router.push("/prediction/new")} />
      {rows.length === 0 && <Muted>No predictions yet. You can also write one from any reading.</Muted>}
      {GROUPS.map((g) => {
        const list = rows.filter((p) => predictionState(p, today) === g.state);
        if (list.length === 0) return null;
        return [
          <SectionLabel key={`${g.state}-label`}>
            {g.label} ({list.length})
          </SectionLabel>,
          ...list.map((p) => <PredictionCard key={p.id} p={p} today={today} />),
        ];
      })}
      {rows.length > 0 && (
        <Card>
          <Strong>Plain counts</Strong>
          <Muted>Patterns shows how many came true, partly, or did not, in your own words.</Muted>
          <Button label="Open Patterns" variant="text" onPress={() => router.push("/patterns")} />
        </Card>
      )}
    </Screen>
  );
}
