// A new reading: ask, write what you sense first, then the cards are drawn and saved at once and the reading opens
// face down. Drawing and saving together means going back cannot draw again, and the sensed words are sealed with a
// time before any card is seen.

import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BUILT_IN_SPREADS, getSpread } from "../../core/spreads";
import { drawForSpread } from "../../core/draw";
import { CONFIDENCE_LABELS, FITS, MAX_GUESS_LENGTH, cleanGuessText, type Confidence } from "../../core/guess-core";
import { createReading, getSettings, type Settings } from "../../db/queries";
import { secureRandom } from "../../lib/random";
import { Body, Button, Card, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen, Strong, Title } from "../../ui/kit";

type Step = "ask" | "sense";

export default function NewReading() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ spread?: string; daily?: string }>();
  const daily = params.daily === "1";
  const [settings, setSettings] = useState<Settings | null>(null);
  const [step, setStep] = useState<Step>("ask");
  const [spreadId, setSpreadId] = useState(getSpread(params.spread ?? "")?.id ?? "past-present-future");
  const [question, setQuestion] = useState(daily ? "My card for today" : "");
  const [guess, setGuess] = useState("");
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings(db).then((s) => {
      setSettings(s);
      // The daily card goes straight to sensing: the question is already written.
      if (daily && s.senseFirst) setStep("sense");
    });
  }, [db, daily]);

  if (!settings) return <Loading />;
  const spread = getSpread(spreadId)!;

  async function draw(sensed: { guess: string; skipped: boolean } | null) {
    if (busy) return;
    setBusy(true);
    try {
      const pieces = drawForSpread(spread, secureRandom, settings!.reversals);
      const id = await createReading(db, {
        tool: "tarot",
        question,
        spreadId: spread.id,
        spreadName: spread.name,
        pieces,
        sensed: sensed && { ...sensed, confidence: sensed.skipped ? null : confidence, sealedAt: new Date().toISOString() },
      });
      router.replace({ pathname: "/reading/[id]", params: { id: String(id), reveal: "1" } });
    } catch (e) {
      setError(`The reading could not be saved: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  if (step === "ask") {
    return (
      <Screen>
        <Title>{daily ? "Today's card" : "Ask"}</Title>
        <Field
          label="Your question (you can leave it empty)"
          value={question}
          onChangeText={setQuestion}
          placeholder="What would help me to see?"
          multiline
          maxLength={500}
        />
        {!daily && (
          <ChoiceRow
            label="Spread"
            options={BUILT_IN_SPREADS.map((s) => ({ value: s.id, label: `${s.name} (${s.positions.length})` }))}
            value={spreadId}
            onChange={(v) => v && setSpreadId(v)}
          />
        )}
        <Muted>{spread.description}</Muted>
        {settings.senseFirst ? (
          <Button label="Next" onPress={() => setStep("sense")} />
        ) : (
          <Button label="Draw the cards" onPress={() => draw(null)} disabled={busy} />
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Write what you sense first</Title>
      <Body>
        Before the {spread.positions.length === 1 ? "card is" : "cards are"} drawn, note your first impression: a feeling, a picture, a word.
        It is sealed with the time and shown beside the cards afterwards.
      </Body>
      <Card>
        <Strong>{question.trim() || spread.name}</Strong>
        <Muted>
          {spread.positions.length} {spread.positions.length === 1 ? "card" : "cards"}: {spread.positions.map((p) => p.name).join(", ")}
        </Muted>
      </Card>
      <Field
        label="What do you sense?"
        value={guess}
        onChangeText={(v) => {
          setGuess(v);
          setError(null);
        }}
        multiline
        maxLength={MAX_GUESS_LENGTH}
        autoFocus
      />
      <ChoiceRow
        label="How sure do you feel? (optional)"
        options={FITS.map((f) => ({ value: f, label: CONFIDENCE_LABELS[f] }))}
        value={confidence}
        onChange={setConfidence}
        allowNone
      />
      <Button
        label="Seal it and draw"
        onPress={() => {
          const c = cleanGuessText(guess);
          if (!c.ok) return setError(c.error);
          draw({ guess: c.text, skipped: false });
        }}
        disabled={busy}
      />
      <Button label="Skip this time" variant="text" onPress={() => draw({ guess: "", skipped: true })} disabled={busy} />
      {error && <ErrorNote>{error}</ErrorNote>}
    </Screen>
  );
}
