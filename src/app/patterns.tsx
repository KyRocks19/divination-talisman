// Patterns: plain counts across the person's own readings. Nothing is graded (design rule 4); the person decides what
// a pattern means.

import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../core/cards";
import { CONFIDENCE_LABELS, FITS, FIT_LABELS, MIN_FITS_FOR_AVERAGE } from "../core/guess-core";
import { recurringCards, summariseSensed, type CardCount, type SensedSummary } from "../core/patterns";
import { patternRows } from "../db/queries";
import { OUTCOMES, OUTCOME_LABELS, countPredictions, localDay, type PredictionCounts } from "../core/predictions";
import { listPredictions } from "../db/predictions";
import { dayText } from "../lib/dates";
import { Body, Card, Loading, Muted, Screen, SectionLabel, Strong } from "../ui/kit";
import { radius, space, useTokens } from "../ui/theme";
import { HERE } from "../lib/where";

export default function Patterns() {
  const db = useSQLiteContext();
  const t = useTokens();
  const [data, setData] = useState<{ readings: number; sensed: SensedSummary; cards: CardCount[]; predictions: PredictionCounts } | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const r = await patternRows(db);
        const predictions = countPredictions(await listPredictions(db), localDay(new Date()));
        setData({ readings: r.readings, sensed: summariseSensed(r.sensed), cards: recurringCards(r.pieces), predictions });
      })();
    }, [db]),
  );

  if (!data) return <Loading />;
  const { sensed } = data;
  const most = Math.max(1, ...FITS.map((f) => sensed.counts[f]));

  return (
    <Screen>
      <Body>
        {data.readings === 0
          ? "Patterns appear here once you have some readings."
          : `${data.readings} ${data.readings === 1 ? "reading" : "readings"} ${HERE}.`}
      </Body>

      <SectionLabel>What you sensed first</SectionLabel>
      <Card>
        <Body>
          You wrote a first impression {sensed.written} {sensed.written === 1 ? "time" : "times"}
          {sensed.setAside ? ` and set the step aside ${sensed.setAside} ${sensed.setAside === 1 ? "time" : "times"}` : ""}.
        </Body>
        <Body>
          You have looked back on {sensed.rated} of them.
          {sensed.average !== null
            ? ` On average you said they fitted ${sensed.average} out of 5.`
            : sensed.rated > 0
              ? ` An average is shown after ${MIN_FITS_FOR_AVERAGE} answers.`
              : ""}
        </Body>
        {sensed.rated > 0 &&
          FITS.map((f) => (
            <View key={f} style={{ gap: 2 }} accessible accessibilityLabel={`${FIT_LABELS[f]}: ${sensed.counts[f]}`}>
              <Muted>
                {FIT_LABELS[f]}: {sensed.counts[f]}
              </Muted>
              <View style={{ height: 8, borderRadius: radius.control, backgroundColor: t.surfaceSunken }}>
                <View style={{ height: 8, borderRadius: radius.control, backgroundColor: t.accentInk, width: `${(sensed.counts[f] / most) * 100}%` }} />
              </View>
            </View>
          ))}
      </Card>

      {sensed.byConfidence.length > 0 && (
        <Card>
          <Strong>How sure you felt, and how it fitted</Strong>
          <Muted>For each level of sureness: how many you looked back on, and how many you said fitted mostly or very well.</Muted>
          {sensed.byConfidence.map((c) => (
            <Body key={c.confidence}>
              {CONFIDENCE_LABELS[c.confidence]}: {c.fittedWell} of {c.rated}
            </Body>
          ))}
        </Card>
      )}

      <SectionLabel>Predictions</SectionLabel>
      <Card onPress={() => router.push("/predictions")} accessibilityHint="Opens your predictions">
        {data.predictions.total === 0 ? (
          <Muted>After a reading, write what you expect to happen. When you look back, the counts show here.</Muted>
        ) : (
          <>
            <Body>
              You wrote {data.predictions.total} {data.predictions.total === 1 ? "prediction" : "predictions"}.
              {data.predictions.due ? ` ${data.predictions.due} ready to look back on.` : ""}
              {data.predictions.waiting ? ` ${data.predictions.waiting} waiting for their day.` : ""}
              {data.predictions.noDate ? ` ${data.predictions.noDate} with no date.` : ""}
            </Body>
            {OUTCOMES.map((o) => (
              <Muted key={o}>
                {OUTCOME_LABELS[o]}: {data.predictions.outcomes[o]}
              </Muted>
            ))}
          </>
        )}
      </Card>

      <SectionLabel>Cards that keep coming up</SectionLabel>
      {data.cards.length === 0 ? (
        <Muted>A card is listed here once it has come up in two or more readings.</Muted>
      ) : (
        data.cards.slice(0, 20).map((c) => (
          <Card
            key={`${c.tool}:${c.pieceId}`}
            onPress={() => router.push(c.tool === "tarot" ? `/card/${c.pieceId}` : { pathname: "/oracle/card", params: { id: c.pieceId } })}
            accessibilityHint="Opens the card and your meanings"
          >
            <Strong>{(c.tool === "tarot" ? getCardById(c.pieceId)?.name : c.name) ?? c.name ?? "A card"}</Strong>
            <Muted>
              In {c.readings} readings{c.reversed ? `, reversed in ${c.reversed}` : ""} · last on {dayText(c.lastSeen)}
            </Muted>
          </Card>
        ))
      )}
    </Screen>
  );
}
