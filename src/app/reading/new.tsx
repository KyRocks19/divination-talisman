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
import {
  MAX_DRAW_LOTS, MAX_THROW_COUNT, SWINGS, THROW_OBJECTS, castGeomancy, castIChing, drawLots, drawTool, getTool, lotNames, throwDice,
} from "../../core/tools";
import type { DiceObjectId } from "../../core/tools/dice-data";
import { Body, Button, Card, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen, Strong, Title } from "../../ui/kit";

type Step = "ask" | "sense" | "swing";

/** The last list of lots, so the same bag can be drawn from again. Kept with the settings. */
const LAST_LOTS = "lastLots";

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
  const [lotsText, setLotsText] = useState("");
  /** Pendulum: what was sensed, sealed before the person swings, waiting for the swing to be noted. */
  const [pending, setPending] = useState<{ guess: string; skipped: boolean; sealedAt: string } | null | undefined>(undefined);
  const [swingId, setSwingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (deckId !== null) {
        const d = await getDeck(db, deckId);
        if (d) setDeck({ deck: d, cards: await listCards(db, deckId) });
      }
      const s = await getSettings(db);
      const lots = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", [LAST_LOTS]);
      if (lots) setLotsText(lots.value);
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
        : tool.kind === "geomancy"
          ? { words: "Four Mothers, and the chart made from them" }
          : tool.kind === "lots"
            ? { words: `${Math.min(count, lotNames(lotsText).length)} of ${lotNames(lotsText).length} lots` }
            : { words: "Then swing your pendulum and note how it moved" };
  const lots = lotNames(lotsText);
  /** The verb for what happens next: cards and lots are drawn, dice and lines are cast, a pendulum swings. */
  const verb = tool?.kind === "pendulum" ? { now: "Next", seal: "Seal it, then swing", before: "the pendulum swings" }
    : tool && tool.kind !== "draw" && tool.kind !== "lots" ? { now: "Cast it", seal: "Seal it and cast", before: "anything is cast" }
      : { now: "Draw", seal: "Seal it and draw", before: "anything is drawn" };

  async function draw(sensed: { guess: string; skipped: boolean; sealedAt?: string } | null) {
    if (busy) return;
    if (tool?.kind === "pendulum" && pending === undefined) {
      // Seal what was sensed now, before the pendulum moves; the reading is saved once the swing is noted.
      setPending(sensed && { ...sensed, sealedAt: new Date().toISOString() });
      setStep("swing");
      return;
    }
    if (tool?.kind === "lots" && lots.length === 0) {
      setError("Write at least one lot, one to a line.");
      setStep("ask");
      return;
    }
    setBusy(true);
    try {
      let made: { spreadId: string | null; spreadName: string | null; pieces: ReturnType<typeof drawForSpread> };
      if (tool?.kind === "pendulum") {
        const sw = SWINGS.find((x) => x.id === swingId)!;
        made = { spreadId: null, spreadName: null, pieces: [{ position: 0, positionName: "How it swung", pieceId: sw.id, pieceName: sw.name, reversed: false }] };
      } else if (tool?.kind === "lots") {
        made = { spreadId: null, spreadName: null, pieces: drawLots(lots, count, secureRandom) };
        await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [LAST_LOTS, lots.join("\n")]);
      } else if (tool?.kind === "throw") {
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
        sensed: sensed && { ...sensed, confidence: sensed.skipped ? null : confidence, sealedAt: sensed.sealedAt ?? new Date().toISOString() },
      });
      // The pendulum's answer is already known to the person, so nothing is turned face down.
      router.replace({ pathname: "/reading/[id]", params: { id: String(id), reveal: tool?.kind === "pendulum" ? "0" : "1" } });
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
        {tool?.kind === "lots" && (
          <>
            <Field
              label="Your lots, one to a line"
              value={lotsText}
              onChangeText={(v) => (setLotsText(v), setError(null))}
              multiline
              placeholder={"The lake\nThe city\nStay home"}
              autoCapitalize="sentences"
            />
            <Muted>
              {lots.length === 0 ? "Repeats and empty lines are left out." : `${lots.length} ${lots.length === 1 ? "lot" : "lots"} in the bag. Repeats and empty lines are left out.`}
            </Muted>
            <ChoiceRow
              label="How many to draw"
              options={Array.from({ length: Math.max(1, Math.min(MAX_DRAW_LOTS, lots.length)) }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
              value={Math.min(count, Math.max(1, lots.length))}
              onChange={(v) => v && setCount(v)}
            />
          </>
        )}
        {tool?.kind === "pendulum" && (
          <Muted>Ask your question, then hold your pendulum still and let it move. You note how it swung; the app does not decide.</Muted>
        )}
        {tool?.kind === "geomancy" && <Muted>Sixteen lines of one or two dots, made by chance, become the four Mothers. The rest of the chart is worked out from them.</Muted>}
        {settings.senseFirst ? (
          <Button
            label="Next"
            onPress={() => {
              if (tool?.kind === "lots" && lots.length === 0) return setError("Write at least one lot, one to a line.");
              setStep("sense");
            }}
          />
        ) : (
          <Button label={verb.now} onPress={() => draw(null)} disabled={busy} />
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </Screen>
    );
  }

  if (step === "swing") {
    return (
      <Screen>
        <Title>How did it swing?</Title>
        <Card>
          <Strong>{question.trim() || "Your question"}</Strong>
          {pending && !pending.skipped ? <Muted>You sensed: {pending.guess}</Muted> : null}
        </Card>
        <ChoiceRow label="The pendulum" options={SWINGS.map((x) => ({ value: x.id, label: `${x.mark} ${x.name}` }))} value={swingId} onChange={setSwingId} />
        {swingId && <Muted>{SWINGS.find((x) => x.id === swingId)!.words}</Muted>}
        <Button label="Save the answer" disabled={!swingId || busy} onPress={() => draw(pending ?? null)} />
        {error && <ErrorNote>{error}</ErrorNote>}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Write what you sense first</Title>
      <Body>
        Before {verb.before}, note your first impression: a feeling, a picture, a word. It is
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
        label={verb.seal}
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
