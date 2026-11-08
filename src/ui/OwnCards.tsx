// Recording a reading laid out with the person's own tarot cards, one position at a time. For each position they take
// a photo of the card (the app suggests which card it looks like) or type part of its name. They always choose; the
// suggestions only save scrolling. Used by src/app/reading/new.tsx.

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TAROT_DECK, getCardById } from "../core/cards";
import { cardsNamed, type Suggestion } from "../core/card-match";
import type { DrawnPiece } from "../core/draw";
import type { Spread } from "../core/spreads";
import { suggestFromPhoto } from "../lib/card-photo";
import { CardImage } from "./CardImage";
import { Body, Button, Card, ErrorNote, Field, Muted, SectionLabel, Strong, Title, ToggleRow } from "./kit";
import { radius, space, useTokens } from "./theme";
import { useType } from "./comfort";

type Chosen = { cardId: string; reversed: boolean } | null;

export function OwnCards({ spread, sensed, busy, onDone }: {
  spread: Spread;
  /** What the person sensed first, shown as a reminder. */
  sensed: string | null;
  busy: boolean;
  onDone: (pieces: DrawnPiece[]) => void;
}) {
  const t = useTokens();
  const type = useType();
  const [chosen, setChosen] = useState<Chosen[]>(() => spread.positions.map(() => null));
  const [at, setAt] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [search, setSearch] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = spread.positions[at];
  const current = chosen[at];
  const allChosen = chosen.every(Boolean);
  const many = spread.positions.length > 1;

  function choose(c: Chosen) {
    setChosen((prev) => prev.map((x, i) => (i === at ? c : x)));
    setSuggestions(null);
    setSearch("");
    setError(null);
  }

  function goTo(i: number) {
    setAt(i);
    setSuggestions(null);
    setSearch("");
    setError(null);
  }

  async function photo(source: "camera" | "library") {
    setError(null);
    setSuggestions(null);
    setLooking(true);
    try {
      const r = await suggestFromPhoto(source);
      if (r.ok) setSuggestions(r.suggestions);
      else if (r.error) setError(r.error);
    } finally {
      setLooking(false);
    }
  }

  const next = chosen.findIndex((c, i) => i > at && !c);
  const firstMissing = chosen.findIndex((c) => !c);
  const usedElsewhere = current && chosen.some((c, i) => i !== at && c?.cardId === current.cardId);
  const found = cardsNamed(TAROT_DECK, search);

  return (
    <>
      <Title>{many ? `${position.name} (${at + 1} of ${spread.positions.length})` : "Your card"}</Title>
      {position.description ? <Muted>{position.description}</Muted> : null}
      {sensed ? <Muted>You sensed: {sensed}</Muted> : null}

      {current ? (
        <Card>
          <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            <CardImage cardId={current.cardId} reversed={current.reversed} width={72} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Strong>{getCardById(current.cardId)?.name}</Strong>
              {current.reversed ? <Muted>Upside down</Muted> : null}
            </View>
          </View>
          <ToggleRow label="Upside down" value={current.reversed} onChange={(v) => choose({ ...current, reversed: v })} />
          {usedElsewhere ? <Muted>This card is also in another position of this reading.</Muted> : null}
        </Card>
      ) : (
        <>
          <Body>Take a photo of this card, close up, or type its name.</Body>
          <Muted>Hold the phone the way you look at the reading, so a card that lies upside down is upside down in the photo too.</Muted>
        </>
      )}

      {!suggestions && (
        <>
          <Button label={current ? "Take a new photo of this card" : "Take a photo of this card"} variant={current ? "quiet" : "primary"} disabled={looking || busy} onPress={() => photo("camera")} />
          <Button label="Use a photo you already have" variant="text" disabled={looking || busy} onPress={() => photo("library")} />
        </>
      )}
      {looking && <Muted accessibilityLiveRegion="polite">Looking at the photo…</Muted>}
      {error && <ErrorNote>{error}</ErrorNote>}

      {suggestions && (
        <>
          <SectionLabel>Is it one of these?</SectionLabel>
          <Muted>The app compares your photo with the Pixie-Smith pictures. Your deck may look different, so check.</Muted>
          {suggestions.map((s) => (
            <Pressable
              key={s.cardId}
              onPress={() => choose({ cardId: s.cardId, reversed: s.reversed })}
              accessibilityRole="button"
              accessibilityLabel={`${getCardById(s.cardId)?.name}${s.reversed ? ", upside down" : ""}`}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                padding: space.sm,
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: t.lineStrong,
                backgroundColor: t.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <CardImage cardId={s.cardId} reversed={s.reversed} width={52} />
              <Text style={{ flex: 1, color: t.ink, ...type({ fontSize: 16 }) }}>
                {getCardById(s.cardId)?.name}
                {s.reversed ? " (upside down)" : ""}
              </Text>
            </Pressable>
          ))}
          <Button label="None of these" variant="text" onPress={() => setSuggestions(null)} />
        </>
      )}

      <Field label="Or type its name" value={search} onChangeText={setSearch} placeholder="For example: 3 cups, or tower" autoCorrect={false} />
      {search.trim() !== "" && found.length === 0 && <Muted>No card has that in its name.</Muted>}
      {found.map((c) => (
        <Button key={c.id} label={c.name} variant="quiet" onPress={() => choose({ cardId: c.id, reversed: current?.reversed ?? false })} />
      ))}

      {many && (
        <>
          <SectionLabel>The reading so far</SectionLabel>
          {spread.positions.map((p, i) => {
            const c = chosen[i];
            return (
              <Pressable
                key={i}
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: i === at }}
                accessibilityLabel={`${p.name}: ${c ? getCardById(c.cardId)?.name : "not chosen yet"}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  gap: space.md,
                  minHeight: 44,
                  alignItems: "center",
                  paddingHorizontal: space.md,
                  borderRadius: radius.control,
                  borderWidth: 1,
                  borderColor: i === at ? t.accentInk : t.line,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ flex: 1, color: t.inkStrong, ...type({ fontSize: 15, bold: "semi" }) }}>{p.name}</Text>
                <Text style={{ flex: 1, color: c ? t.ink : t.inkMuted, ...type({ fontSize: 15 }), textAlign: "right" }}>
                  {c ? `${getCardById(c.cardId)?.name}${c.reversed ? ", upside down" : ""}` : "Not chosen yet"}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      {allChosen ? (
        <Button
          label="Save the reading"
          disabled={busy}
          onPress={() =>
            onDone(
              spread.positions.map((p, i) => {
                const c = chosen[i]!;
                return { position: i, positionName: p.name, pieceId: c.cardId, pieceName: getCardById(c.cardId)!.name, reversed: c.reversed };
              }),
            )
          }
        />
      ) : current ? (
        <Button label="Next position" onPress={() => goTo(next >= 0 ? next : firstMissing)} />
      ) : null}
    </>
  );
}
