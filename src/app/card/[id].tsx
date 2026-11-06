// One card: the person's own meanings first, each with its earlier versions; the built-in text behind its own button.

import { useCallback, useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../../core/cards";
import { getMeanings, type MeaningRow, type Orientation } from "../../db/queries";
import { OwnMeaning } from "../../ui/OwnMeaning";
import { CardImage } from "../../ui/CardImage";
import { Body, Button, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";
import { radius, space, useTokens } from "../../ui/theme";
import { HERE } from "../../lib/where";

export default function CardScreen() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = getCardById(id);
  const [meanings, setMeanings] = useState<Partial<Record<Orientation, MeaningRow>>>({});

  const load = useCallback(async () => setMeanings(await getMeanings(db, "tarot", id)), [db, id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    if (card) nav.setOptions({ title: card.name });
  }, [card, nav]);

  if (!card) {
    return (
      <Screen>
        <Body>This card is not in the deck.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: "center" }}>
        <CardImage cardId={card.id} width={Math.min(width * 0.5, 240)} />
      </View>
      <Muted style={{ textAlign: "center" }}>Your words come first. They are kept {HERE}, and every earlier version is kept too.</Muted>
      <OwnMeaning tool="tarot" pieceId={card.id} orientation="upright" row={meanings.upright} onSaved={load} />
      <OwnMeaning tool="tarot" pieceId={card.id} orientation="reversed" row={meanings.reversed} onSaved={load} />
      <Stock cardId={card.id} />
    </Screen>
  );
}

function Stock({ cardId }: { cardId: string }) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const card = getCardById(cardId)!;
  return (
    <>
      <Button label={open ? "Hide Pixie-Smith meanings" : "Pixie-Smith meanings"} variant="quiet" onPress={() => setOpen(!open)} />
      {open && (
        <View style={{ backgroundColor: t.surfaceSunken, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
          <SectionLabel>Upright</SectionLabel>
          <Strong>{card.uprightMeaning}</Strong>
          <Body>{card.uprightDescription}</Body>
          <SectionLabel>Reversed</SectionLabel>
          <Strong>{card.reversedMeaning}</Strong>
          <Body>{card.reversedDescription}</Body>
        </View>
      )}
    </>
  );
}
