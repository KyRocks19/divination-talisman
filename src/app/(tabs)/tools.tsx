import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BUILT_IN_SPREADS } from "../../core/spreads";
import { listDecks, type Deck } from "../../db/oracle";
import { Button, Card, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";

export default function Tools() {
  const db = useSQLiteContext();
  const [decks, setDecks] = useState<Deck[]>([]);

  useFocusEffect(
    useCallback(() => {
      listDecks(db).then(setDecks);
    }, [db]),
  );

  return (
    <Screen>
      <SectionLabel>Tarot</SectionLabel>
      {BUILT_IN_SPREADS.map((s) => (
        <Card
          key={s.id}
          onPress={() => router.push({ pathname: "/reading/new", params: { spread: s.id } })}
          accessibilityLabel={`${s.name}, ${s.positions.length} ${s.positions.length === 1 ? "card" : "cards"}`}
          accessibilityHint="Starts a reading with this spread"
        >
          <Strong>{s.name}</Strong>
          <Muted>
            {s.positions.length} {s.positions.length === 1 ? "card" : "cards"} · {s.description}
          </Muted>
        </Card>
      ))}

      <SectionLabel>Your oracle decks</SectionLabel>
      {decks.length === 0 && <Muted>Make a deck out of your own life: your own cards, pictures, fields and meanings.</Muted>}
      {decks.map((d) => (
        <Card key={d.id} onPress={() => router.push(`/oracle/${d.id}`)} accessibilityHint="Opens the deck">
          <Strong>{d.name}</Strong>
          <Muted>
            {d.cardCount} {d.cardCount === 1 ? "card" : "cards"}
            {d.description ? ` · ${d.description}` : ""}
          </Muted>
        </Card>
      ))}
      <Button label="Make a deck" variant="quiet" onPress={() => router.push("/oracle/deck-edit")} />

      <SectionLabel>Learn</SectionLabel>
      <Card onPress={() => router.push("/library")} accessibilityHint="Opens the 78 cards">
        <Strong>Card library</Strong>
        <Muted>All 78 tarot cards, with your own meanings first.</Muted>
      </Card>

      <SectionLabel>Coming later</SectionLabel>
      <Muted>
        Runes, dice and coins, the pendulum, the I Ching, ogham, geomancy, playing cards, lots, signs and dreams, and blind-target practice.
      </Muted>
    </Screen>
  );
}
