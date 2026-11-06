// One of the person's oracle decks: its cards, and the way into a pull.

import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getDeck, listCards, type Deck, type OracleCard } from "../../db/oracle";
import { Body, Button, Loading, Muted, Screen } from "../../ui/kit";
import { OracleImage } from "../../ui/OracleImage";
import { space, useTokens } from "../../ui/theme";
import { HERE } from "../../lib/where";

const COLUMNS = 3;

export default function DeckScreen() {
  const db = useSQLiteContext();
  const t = useTokens();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const id = Number(deckId);
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [cards, setCards] = useState<OracleCard[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setDeck(await getDeck(db, id));
        setCards(await listCards(db, id));
      })();
    }, [db, id]),
  );
  useEffect(() => {
    if (deck) nav.setOptions({ title: deck.name });
  }, [deck, nav]);

  if (deck === undefined) return <Loading />;
  if (deck === null) {
    return (
      <Screen>
        <Body>This deck is no longer {HERE}.</Body>
      </Screen>
    );
  }

  const cardWidth = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;
  return (
    <Screen>
      {deck.description ? <Body>{deck.description}</Body> : null}
      <Button
        label="Pull cards"
        disabled={cards.length === 0}
        onPress={() => router.push({ pathname: "/reading/new", params: { deck: String(deck.id), spread: "single" } })}
      />
      {cards.length === 0 && <Muted>Add your first card, then you can pull from this deck.</Muted>}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button label="Add a card" variant="quiet" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/oracle/card", params: { deck: String(deck.id) } })} />
        <Button label="Change deck" variant="quiet" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/oracle/deck-edit", params: { id: String(deck.id) } })} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        {cards.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: "/oracle/card", params: { id: String(c.id) } })}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            style={({ pressed }) => ({ width: cardWidth, gap: space.xs, opacity: pressed ? 0.8 : 1 })}
          >
            <OracleImage photo={c.photo ? { photo: c.photo, linked: c.photoLinked } : null} name={c.name} width={cardWidth} />
            <Text style={{ color: t.ink, fontSize: 13, textAlign: "center" }} numberOfLines={2}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
