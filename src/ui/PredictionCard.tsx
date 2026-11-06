// A prediction in a list: its words, where it stands, and the reading it came from.

import { router } from "expo-router";
import { OUTCOME_LABELS, dayWords, predictionState } from "../core/predictions";
import type { PredictionListItem } from "../db/predictions";
import { dayText } from "../lib/dates";
import { Body, Card, Muted } from "./kit";

export function PredictionCard({ p, today }: { p: PredictionListItem; today: string }) {
  const state = predictionState(p, today);
  return (
    <Card onPress={() => router.push(`/prediction/${p.id}`)} accessibilityHint="Opens the prediction">
      <Body numberOfLines={3}>{p.text}</Body>
      <Muted>
        {state === "looked-back" && p.outcome
          ? OUTCOME_LABELS[p.outcome]
          : p.look_back_on
            ? `Look back on ${dayWords(p.look_back_on)}`
            : "No date"}
        {p.reading_title ? ` · ${p.reading_title}` : ""}
        {` · written ${dayText(p.created_at)}`}
      </Muted>
    </Card>
  );
}
