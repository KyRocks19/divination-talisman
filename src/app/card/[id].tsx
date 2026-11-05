// One card: the person's own meanings first, each with its earlier versions; the built-in text behind its own button.

import { useCallback, useEffect, useState } from "react";
import { Alert, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../../core/cards";
import { deleteHistoryEntry, getMeanings, meaningHistory, saveMeaning, type HistoryRow, type MeaningRow, type Orientation } from "../../db/queries";
import { dayText } from "../../lib/dates";
import { CardImage } from "../../ui/CardImage";
import { Body, Button, Card, Field, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";
import { radius, space, useTokens } from "../../ui/theme";

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
      <Muted style={{ textAlign: "center" }}>Your words come first. They are kept on this phone, and every earlier version is kept too.</Muted>
      <OwnMeaning cardId={card.id} orientation="upright" row={meanings.upright} onSaved={load} />
      <OwnMeaning cardId={card.id} orientation="reversed" row={meanings.reversed} onSaved={load} />
      <Stock cardId={card.id} />
    </Screen>
  );
}

function OwnMeaning({ cardId, orientation, row, onSaved }: { cardId: string; orientation: Orientation; row?: MeaningRow; onSaved: () => void }) {
  const db = useSQLiteContext();
  const [text, setText] = useState(row?.text ?? "");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const saved = row?.text ?? "";

  useEffect(() => setText(row?.text ?? ""), [row?.text]);
  useEffect(() => {
    if (row) meaningHistory(db, row.id).then(setHistory);
    else setHistory([]);
  }, [db, row]);

  const label = orientation === "upright" ? "Your meaning, upright" : "Your meaning, reversed";
  return (
    <Card>
      <Field label={label} value={text} onChangeText={setText} multiline placeholder="What does this card mean to you?" />
      {row && <Muted>Last changed {dayText(row.updated_at)}</Muted>}
      <Button
        label={text.trim() === saved ? "Saved" : text.trim() ? "Save" : "Empty it"}
        disabled={text.trim() === saved}
        onPress={async () => {
          const save = async () => {
            await saveMeaning(db, "tarot", cardId, orientation, text);
            onSaved();
          };
          if (text.trim()) return save();
          Alert.alert("Empty this meaning?", "Your words and their earlier versions are deleted from this phone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Empty it", style: "destructive", onPress: save },
          ]);
        }}
      />
      {history.length > 0 && (
        <Button
          label={showHistory ? "Hide earlier versions" : `Earlier versions (${history.length})`}
          variant="text"
          onPress={() => setShowHistory(!showHistory)}
        />
      )}
      {showHistory &&
        history.map((h) => (
          <View key={h.id} style={{ gap: 2 }}>
            <Muted>{dayText(h.saved_at)}</Muted>
            <Body>{h.text}</Body>
            <Button
              label="Delete this version"
              variant="text"
              onPress={async () => {
                await deleteHistoryEntry(db, h.id);
                setHistory(history.filter((x) => x.id !== h.id));
              }}
            />
          </View>
        ))}
    </Card>
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
