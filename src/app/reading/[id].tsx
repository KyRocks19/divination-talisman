// One reading. Opened straight after drawing, the cards are face down until the person turns each one over (tap, with
// a light buzz). The person's own meaning comes first; the built-in text waits behind its own button.

import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Share, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as Haptics from "expo-haptics";
import { getCardById } from "../../core/cards";
import { getSpread } from "../../core/spreads";
import { CONFIDENCE_LABELS, FITS, FIT_LABELS, type Fit } from "../../core/guess-core";
import { NOTHING_EXTRA, readingToMarkdown } from "../../core/share-reading-core";
import {
  addJournalEntry, allMeanings, deleteJournalEntry, deleteReading, getReading, setFit, updateReadingNotes,
  type FullReading, type PieceRow,
} from "../../db/queries";
import { dayText, dayTimeText } from "../../lib/dates";
import { CardImage } from "../../ui/CardImage";
import { OracleImage } from "../../ui/OracleImage";
import { cardsById, getDeck, ORACLE_TOOL, type OracleCard } from "../../db/oracle";
import type { FieldDef } from "../../core/oracle";
import { Body, Button, Card, ChoiceRow, Field, Loading, Muted, Screen, SectionLabel, Strong, Title, ToggleRow } from "../../ui/kit";
import { radius, space, useTokens } from "../../ui/theme";
import { HERE, THIS_DEVICE } from "../../lib/where";

export default function ReadingScreen() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const readingId = Number(id);
  const [data, setData] = useState<FullReading | null | undefined>(undefined);
  const [own, setOwn] = useState<Map<string, string>>(new Map());
  const [oracle, setOracle] = useState<OracleInfo | null>(null);
  const [revealed, setRevealed] = useState<Set<number> | null>(null);

  const load = useCallback(async () => {
    const r = await getReading(db, readingId);
    setData(r);
    setOwn(await allMeanings(db, r?.reading.tool ?? "tarot"));
    if (r?.reading.tool === ORACLE_TOOL) {
      const cards = await cardsById(db, r.pieces.map((p) => Number(p.piece_id)));
      const deck = r.reading.deck_id ? await getDeck(db, r.reading.deck_id) : null;
      setOracle({ cards, fields: deck?.fields ?? [], deckName: deck?.name ?? null });
    }
    if (r) setRevealed((prev) => prev ?? new Set(reveal === "1" ? [] : r.pieces.map((p) => p.position)));
  }, [db, readingId, reveal]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (data) nav.setOptions({ title: data.reading.spread_name ?? "Reading" });
  }, [data, nav]);

  if (data === undefined || revealed === null) return <Loading />;
  if (data === null) {
    return (
      <Screen>
        <Body>This reading is no longer {HERE}.</Body>
      </Screen>
    );
  }

  const { reading, pieces, sensed, journal } = data;
  const allShown = pieces.every((p) => revealed.has(p.position));

  function turnOver(position: number) {
    if (revealed!.has(position)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setRevealed(new Set([...revealed!, position]));
  }

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Title>{reading.question || reading.spread_name || "Reading"}</Title>
        <Muted>
          {dayTimeText(reading.created_at)}
          {oracle?.deckName ? ` · ${oracle.deckName}` : ""}
        </Muted>
      </View>

      {sensed && !sensed.skipped && (
        <Card>
          <SectionLabel>What you sensed first</SectionLabel>
          <Body>{sensed.guess}</Body>
          <Muted>
            Sealed {dayTimeText(sensed.sealed_at)}
            {sensed.confidence ? ` · ${CONFIDENCE_LABELS[sensed.confidence]}` : ""}
          </Muted>
        </Card>
      )}

      <Pieces pieces={pieces} revealed={revealed} own={own} oracle={oracle} spreadId={reading.spread_id} onTurn={turnOver} />

      {!allShown && (
        <Button
          label="Turn them all over"
          variant="quiet"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            setRevealed(new Set(pieces.map((p) => p.position)));
          }}
        />
      )}

      {allShown && (
        <>
          {sensed && !sensed.skipped && <LookBack readingId={reading.id} fit={sensed.fit} note={sensed.fit_note} onSaved={load} />}
          <Notes readingId={reading.id} initial={reading.notes} />
          <Journal readingId={reading.id} entries={journal} onChange={load} />
          <ShareAndDelete data={data} oracle={oracle} />
        </>
      )}
    </Screen>
  );
}

/** For a pull from an oracle deck: its cards as they are now (a deleted card is missing), and the deck's fields. */
interface OracleInfo {
  cards: Map<number, OracleCard>;
  fields: FieldDef[];
  deckName: string | null;
}

/** The name to show for a piece: tarot from the deck, oracle as the card is called now, else as it was when drawn. */
function pieceName(piece: PieceRow, oracle: OracleInfo | null): string {
  if (oracle) return oracle.cards.get(Number(piece.piece_id))?.name ?? piece.piece_name ?? "A card you deleted";
  return getCardById(piece.piece_id)?.name ?? piece.piece_name ?? piece.piece_id;
}

function Pieces({ pieces, revealed, own, oracle, spreadId, onTurn }: {
  pieces: PieceRow[];
  revealed: Set<number>;
  own: Map<string, string>;
  oracle: OracleInfo | null;
  spreadId: string | null;
  onTurn: (position: number) => void;
}) {
  const { width } = useWindowDimensions();
  const itemWidth = pieces.length === 1 ? width - space.lg * 2 : Math.min(width * 0.78, 420);
  const spread = spreadId ? getSpread(spreadId) : undefined;
  return (
    <FlatList
      horizontal
      data={pieces}
      keyExtractor={(p) => String(p.position)}
      showsHorizontalScrollIndicator={false}
      snapToInterval={itemWidth + space.md}
      decelerationRate="fast"
      ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
      style={{ marginHorizontal: -space.lg }}
      contentContainerStyle={{ paddingHorizontal: space.lg }}
      renderItem={({ item, index }) => (
        <PieceCard
          piece={item}
          index={index}
          total={pieces.length}
          width={itemWidth}
          shown={revealed.has(item.position)}
          own={own.get(`${item.piece_id}:${item.reversed ? "reversed" : "upright"}`)}
          oracle={oracle}
          prompt={spread?.positions[item.position]?.description}
          color={spread?.positions[item.position]?.color}
          onTurn={() => onTurn(item.position)}
        />
      )}
    />
  );
}

function PieceCard({ piece, index, total, width, shown, own, oracle, prompt, color, onTurn }: {
  piece: PieceRow;
  index: number;
  total: number;
  width: number;
  shown: boolean;
  own?: string;
  oracle: OracleInfo | null;
  prompt?: string;
  color?: string;
  onTurn: () => void;
}) {
  const t = useTokens();
  const [stock, setStock] = useState(false);
  const card = oracle ? undefined : getCardById(piece.piece_id);
  const oracleCard = oracle?.cards.get(Number(piece.piece_id));
  const name = pieceName(piece, oracle);
  const reversed = !!piece.reversed;
  const pictureWidth = Math.min(width * 0.62, 220);
  const where = `${index + 1} of ${total}, ${piece.position_name}`;
  return (
    <View style={{ width, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /> : null}
        <Strong style={{ flex: 1 }}>{piece.position_name}</Strong>
        <Muted>
          {index + 1}/{total}
        </Muted>
      </View>
      {prompt ? <Muted>{prompt}</Muted> : null}
      <Pressable
        onPress={onTurn}
        disabled={shown}
        accessibilityRole={shown ? "image" : "button"}
        accessibilityLabel={shown ? `${where}: ${name}${reversed ? ", reversed" : ""}` : `${where}, face down`}
        accessibilityHint={shown ? undefined : "Turns the card over"}
        style={{ alignSelf: "center", paddingVertical: space.sm }}
      >
        {oracle ? (
          <OracleImage
            photo={oracleCard?.photo ? { photo: oracleCard.photo, linked: oracleCard.photoLinked } : null}
            name={name}
            width={pictureWidth}
            faceDown={!shown}
            reversed={reversed}
          />
        ) : (
          <CardImage cardId={piece.piece_id} reversed={reversed} faceDown={!shown} width={pictureWidth} />
        )}
      </Pressable>
      {!shown ? (
        <Muted style={{ textAlign: "center" }}>Tap to turn it over</Muted>
      ) : (
        <>
          <Strong style={{ textAlign: "center" }}>
            {name}
            {reversed ? " (reversed)" : ""}
          </Strong>
          {oracleCard &&
            oracle!.fields
              .filter((f) => oracleCard.values[f.id])
              .map((f) => (
                <View key={f.id} style={{ gap: 2 }}>
                  <SectionLabel>{f.name}</SectionLabel>
                  <Body>{oracleCard.values[f.id]}</Body>
                </View>
              ))}
          {own ? (
            <View style={{ gap: 2 }}>
              <SectionLabel>Your meaning</SectionLabel>
              <Body>{own}</Body>
            </View>
          ) : (
            <Muted>You have not written your own meaning for this card{reversed ? " reversed" : oracle ? "" : " upright"} yet.</Muted>
          )}
          {(!oracle || oracleCard) && (
            <Button
              label={own ? "Change your meaning" : "Write your meaning"}
              variant="text"
              onPress={() =>
                router.push(oracle ? { pathname: "/oracle/card", params: { id: piece.piece_id } } : `/card/${piece.piece_id}`)
              }
            />
          )}
          {!oracle && (
          <Button
            label={stock ? "Hide Pixie-Smith meanings" : "Pixie-Smith meanings"}
            variant="quiet"
            onPress={() => setStock(!stock)}
            accessibilityHint="Shows or hides the built-in text for this card"
          />
          )}
          {stock && card && (
            <View style={{ backgroundColor: t.surfaceSunken, borderRadius: radius.control, padding: space.md, gap: space.xs }}>
              <Strong>{reversed ? card.reversedMeaning : card.uprightMeaning}</Strong>
              <Body>{reversed ? card.reversedDescription : card.uprightDescription}</Body>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function LookBack({ readingId, fit, note, onSaved }: { readingId: number; fit: Fit | null; note: string | null; onSaved: () => void }) {
  const db = useSQLiteContext();
  const [value, setValue] = useState<Fit | null>(fit);
  const [words, setWords] = useState(note ?? "");
  const [saved, setSaved] = useState(false);
  const changed = value !== fit || (words.trim() || null) !== (note ?? null);
  return (
    <Card>
      <SectionLabel>Looking back</SectionLabel>
      <Muted>
        When you know how things went, say how well what you sensed fitted. There is no right answer; this is for you to notice your own
        patterns.
      </Muted>
      <ChoiceRow
        label="How well did it fit?"
        options={FITS.map((f) => ({ value: f, label: FIT_LABELS[f] }))}
        value={value}
        onChange={(v) => {
          setValue(v);
          setSaved(false);
        }}
        allowNone
      />
      <Field label="A note (optional)" value={words} onChangeText={(v) => (setWords(v), setSaved(false))} multiline maxLength={1000} />
      <Button
        label={saved ? "Saved" : "Save"}
        disabled={!changed && !saved}
        onPress={async () => {
          await setFit(db, readingId, value, value === null ? null : words);
          setSaved(true);
          onSaved();
        }}
      />
    </Card>
  );
}

function Notes({ readingId, initial }: { readingId: number; initial: string }) {
  const db = useSQLiteContext();
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  return (
    <Card>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What do you notice?" />
      <Button
        label={notes === saved ? "Saved" : "Save notes"}
        disabled={notes === saved}
        onPress={async () => {
          await updateReadingNotes(db, readingId, notes);
          setSaved(notes);
        }}
      />
    </Card>
  );
}

function Journal({ readingId, entries, onChange }: { readingId: number; entries: FullReading["journal"]; onChange: () => void }) {
  const db = useSQLiteContext();
  const [draft, setDraft] = useState("");
  return (
    <Card>
      <SectionLabel>Journal</SectionLabel>
      {entries.length === 0 && <Muted>Add entries over the coming days as things unfold.</Muted>}
      {entries.map((e) => (
        <View key={e.id} style={{ gap: 2 }}>
          <Muted>{dayText(e.created_at)}</Muted>
          <Body>{e.body}</Body>
          <Button
            label="Delete entry"
            variant="text"
            onPress={() =>
              Alert.alert("Delete this entry?", "This cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => (await deleteJournalEntry(db, e.id), onChange()) },
              ])
            }
          />
        </View>
      ))}
      <Field label="New entry" value={draft} onChangeText={setDraft} multiline />
      <Button
        label="Add entry"
        variant="quiet"
        disabled={!draft.trim()}
        onPress={async () => {
          await addJournalEntry(db, readingId, draft);
          setDraft("");
          onChange();
        }}
      />
    </Card>
  );
}

function ShareAndDelete({ data, oracle }: { data: FullReading; oracle: OracleInfo | null }) {
  const db = useSQLiteContext();
  const [withQuestion, setWithQuestion] = useState(false);
  const [withNotes, setWithNotes] = useState(false);
  const { reading, pieces } = data;
  return (
    <Card>
      <SectionLabel>Share as text</SectionLabel>
      <Muted>Only the cards are in the text unless you add more.</Muted>
      <ToggleRow label="Add the question" value={withQuestion} onChange={setWithQuestion} />
      <ToggleRow label="Add the date and notes" value={withNotes} onChange={setWithNotes} />
      <Button
        label="Share"
        variant="quiet"
        onPress={() => {
          const text = readingToMarkdown(
            {
              title: null,
              spread_name: reading.spread_name ?? "Reading",
              question: reading.question,
              created_at: reading.created_at,
              notes: reading.notes,
              cards: pieces.map((p) => ({ position: p.position_name, card_name: pieceName(p, oracle), reversed: !!p.reversed })),
              clarifiers: {},
            },
            [],
            { ...NOTHING_EXTRA, question: withQuestion, date: withNotes, notes: withNotes },
          );
          Share.share({ message: text }).catch(() => undefined);
        }}
      />
      <Button
        label="Delete this reading"
        variant="danger"
        onPress={() =>
          Alert.alert("Delete this reading?", `Its cards, what you sensed, its notes and its journal entries are deleted from ${THIS_DEVICE}. This cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                await deleteReading(db, reading.id);
                router.back();
              },
            },
          ])
        }
      />
    </Card>
  );
}
