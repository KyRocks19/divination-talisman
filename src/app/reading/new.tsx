// A new reading: ask, write what you sense first, then the cards are drawn and saved at once and the reading opens
// face down. Drawing and saving together means going back cannot draw again, and the sensed words are sealed with a
// time before any card is seen. With ?deck=ID it is a pull from one of the person's own oracle decks; with ?tool=ID
// it is a reading with one of the other tools (runes, dice, the I Ching and the rest, src/core/tools.ts).

import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BUILT_IN_SPREADS, getSpread } from "../../core/spreads";
import { drawForSpread, drawPieces } from "../../core/draw";
import { CONFIDENCE_LABELS, FITS, MAX_GUESS_LENGTH, cleanGuessText, type Confidence } from "../../core/guess-core";
import { createReading, getSettings, type Settings } from "../../db/queries";
import { getDeck, listCards, ORACLE_TOOL, type Deck, type OracleCard } from "../../db/oracle";
import { secureRandom } from "../../lib/random";
import { MAX_THROW_COUNT, THROW_OBJECTS, castGeomancy, castIChing, drawTool, getTool, throwDice } from "../../core/tools";
import type { DiceObjectId } from "../../core/tools/dice-data";
import { Body, Button, Card, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen, Strong, Title } from "../../ui/kit";

type Step = "ask" | "sense";

export default function NewReading() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ spread?: string; daily?: string; deck?: string; tool?: string }>();
  const tool = params.tool ? getTool(params.tool) : undefined;
  const daily = params.daily === "1";
  const deckId = params.deck ? Number(params.deck) : null;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [deck, setDeck] = useState<{ deck: Deck; cards: OracleCard[] } | null>(null);
  const [step, setStep] = useState<Step>("ask");
  const [spreadId, setSpreadId] = useState(getSpread(params.spread ?? "")?.id ?? "past-present-future");
  const [question, setQuestion] = useState(daily ? "My card for today" : "");
  const [guess, setGuess] = useState("");
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [object, setObject] = useState<DiceObjectId>("coin");
  const [count, setCount] = useState(1);
  const [method, setMethod] = useState<"coins" | "yarrow">("coins");

  useEffect(() => {
    (async () => {
      if (deckId !== null) {
        const d = await getDeck(db, deckId);
        if (d) setDeck({ deck: d, cards: await listCards(db, deckId) });
      }
      const s = await getSettings(db);
      setSettings(s);
      // The daily card goes straight to sensing: the question is already written.
      if (daily && s.senseFirst) setStep("sense");
    })();
  }, [db, daily, deckId]);

  if (!settings || (deckId !== null && !deck)) return <Loading />;
  const spread = getSpread(spreadId)!;
  // A pull can use any spread with no more positions than the deck has cards.
  const available = deck ? deck.cards.length : tool?.kind === "draw" ? tool.pieces().length : 78;
  const spreads = BUILT_IN_SPREADS.filter((s) => s.positions.length <= available);
  const usesSpread = !tool || tool.kind === "draw";
  const thrown = THROW_OBJECTS.find((o) => o.id === object)!;
  /** What the sense-first step says will happen, and how many pieces. */
  const what: { words: string } = !tool || tool.kind === "draw"
    ? { words: `${spread.positions.length} ${spread.positions.length === 1 ? (tool?.pieceWord ?? "card") : `${tool?.pieceWord ?? "card"}s`}: ${spread.positions.map((p) => p.name).join(", ")}` }
    : tool.kind === "throw"
      ? { words: `${count} × ${thrown.name}` }
      : tool.kind === "iching"
        ? { words: method === "coins" ? "Six lines, cast with three coins" : "Six lines, cast with yarrow stalks" }
        : { words: "Four Mothers, and the chart made from them" };

  async function draw(sensed: { guess: string; skipped: boolean } | null) {
    if (busy) return;
    setBusy(true);
    try {
      let made: { spreadId: string | null; spreadName: string | null; pieces: ReturnType<typeof drawForSpread> };
      if (tool?.kind === "throw") {
        made = { spreadId: null, spreadName: null, pieces: throwDice(object, count, secureRandom) };
      } else if (tool?.kind === "iching") {
        made = castIChing(method, secureRandom);
      } else if (tool?.kind === "geomancy") {
        made = castGeomancy(secureRandom);
      } else {
        const pieces = deck
          ? drawPieces(
              deck.cards.map((c) => ({ id: String(c.id), name: c.name })),
              spread,
              secureRandom,
              deck.deck.reversals,
            )
          : tool
            ? drawTool(tool, spread, secureRandom, settings!.reversals)
            : drawForSpread(spread, secureRandom, settings!.reversals);
        made = { spreadId: spread.id, spreadName: spread.name, pieces };
      }
      const id = await createReading(db, {
        tool: deck ? ORACLE_TOOL : (tool?.id ?? "tarot"),
        question,
        spreadId: made.spreadId,
        spreadName: made.spreadName,
        deckId: deck?.deck.id ?? null,
        pieces: made.pieces,
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
        <Title>{daily ? "Today's card" : deck ? `Pull from ${deck.deck.name}` : tool ? tool.name : "Ask"}</Title>
        <Field
          label="Your question (you can leave it empty)"
          value={question}
          onChangeText={setQuestion}
          placeholder="What would help me to see?"
          multiline
          maxLength={500}
        />
        {!daily && usesSpread && (
          <ChoiceRow
            label="Spread"
            options={spreads.map((s) => ({ value: s.id, label: `${s.name} (${s.positions.length})` }))}
            value={spreadId}
            onChange={(v) => v && setSpreadId(v)}
          />
        )}
        {usesSpread && <Muted>{spread.description}</Muted>}
        {tool?.kind === "throw" && (
          <>
            <ChoiceRow
              label="What to throw"
              options={THROW_OBJECTS.map((o) => ({ value: o.id, label: o.name }))}
              value={object}
              onChange={(v) => v && setObject(v)}
            />
            <ChoiceRow
              label="How many"
              options={Array.from({ length: MAX_THROW_COUNT }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
              value={count}
              onChange={(v) => v && setCount(v)}
            />
          </>
        )}
        {tool?.kind === "iching" && (
          <>
            <ChoiceRow
              label="How to cast the lines"
              options={[
                { value: "coins" as const, label: "Three coins" },
                { value: "yarrow" as const, label: "Yarrow stalks" },
              ]}
              value={method}
              onChange={(v) => v && setMethod(v)}
            />
            <Muted>
              {method === "coins"
                ? "Each line is three coin tosses, heads counting 3 and tails 2."
                : "Each line has the odds of the yarrow-stalk count, where old yang comes up more often than old yin."}
            </Muted>
          </>
        )}
        {tool?.kind === "geomancy" && <Muted>Sixteen lines of one or two dots, made by chance, become the four Mothers. The rest of the chart is worked out from them.</Muted>}
        {settings.senseFirst ? (
          <Button label="Next" onPress={() => setStep("sense")} />
        ) : (
          <Button label={tool && tool.kind !== "draw" ? "Cast it" : "Draw"} onPress={() => draw(null)} disabled={busy} />
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Write what you sense first</Title>
      <Body>
        Before anything is {tool && tool.kind !== "draw" ? "cast" : "drawn"}, note your first impression: a feeling, a picture, a word. It is
        sealed with the time and shown beside the result afterwards.
      </Body>
      <Card>
        <Strong>{question.trim() || (usesSpread ? spread.name : tool!.name)}</Strong>
        <Muted>{what.words}</Muted>
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
        label={tool && tool.kind !== "draw" ? "Seal it and cast" : "Seal it and draw"}
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
