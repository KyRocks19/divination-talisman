// One reading. Opened straight after drawing, the cards are face down until the person turns each one over (tap, with
// a light buzz). The person's own meaning comes first; the built-in text waits behind its own button.

import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Share, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as Haptics from "expo-haptics";
import { getCardById } from "../../core/cards";
import { getSpread } from "../../core/spreads";
import { CONFIDENCE_LABELS, FIT_LABELS } from "../../core/guess-core";
import { NOTHING_EXTRA, readingToMarkdown } from "../../core/share-reading-core";
import {
  allMeanings, deleteReading, getReading, updateReadingNotes,
  type FullReading, type PieceRow,
} from "../../db/queries";
import { dayTimeText } from "../../lib/dates";
import { CardImage } from "../../ui/CardImage";
import { OracleImage } from "../../ui/OracleImage";
import { cardsById, getDeck, ORACLE_TOOL, type OracleCard } from "../../db/oracle";
import type { FieldDef } from "../../core/oracle";
import { Body, Button, Card, ErrorNote, Field, Loading, Muted, Screen, Section, SectionLabel, Strong, Title, ToggleRow } from "../../ui/kit";
import { radius, space, useTokens } from "../../ui/theme";
import { HERE, ON_WEB, THIS_DEVICE } from "../../lib/where";
import { WholeReading } from "../../ui/WholeReading";
import {
  addTagToReading, listTags, predictionsForReading, removeTagFromReading, tagsForReading, cleanTagName, MAX_TAG_LENGTH,
  type PredictionRow, type TagRow, type TagWithCount,
} from "../../db/predictions";
import { OUTCOME_LABELS, dayWords } from "../../core/predictions";
import { ICHING_LINE_WORDS, coinTally, geomancyHow, getTool, ichingCastOf, throwTotal, type ToolDef } from "../../core/tools";
import { cleanRandomUsed, randomUsedWords } from "../../core/random-source";
import { Glyph } from "../../ui/Glyph";
import { TraditionalText } from "../../ui/TraditionalText";

export default function ReadingScreen() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const { id, reveal, chanceProblem } = useLocalSearchParams<{ id: string; reveal?: string; chanceProblem?: string }>();
  const readingId = Number(id);
  const [data, setData] = useState<FullReading | null | undefined>(undefined);
  const [own, setOwn] = useState<Map<string, string>>(new Map());
  const [oracle, setOracle] = useState<OracleInfo | null>(null);
  const [revealed, setRevealed] = useState<Set<number> | null>(null);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [tags, setTags] = useState<{ mine: TagRow[]; all: TagWithCount[] }>({ mine: [], all: [] });

  const load = useCallback(async () => {
    const r = await getReading(db, readingId);
    setData(r);
    setOwn(await allMeanings(db, r?.reading.tool ?? "tarot"));
    if (r?.reading.tool === ORACLE_TOOL) {
      const cards = await cardsById(db, r.pieces.map((p) => Number(p.piece_id)));
      const deck = r.reading.deck_id ? await getDeck(db, r.reading.deck_id) : null;
      setOracle({ cards, fields: deck?.fields ?? [], deckName: deck?.name ?? null });
    }
    if (r) {
      setPredictions(await predictionsForReading(db, readingId));
      setTags({ mine: await tagsForReading(db, readingId), all: await listTags(db) });
      setRevealed((prev) => prev ?? new Set(reveal === "1" ? [] : r.pieces.map((p) => p.position)));
    }
  }, [db, readingId, reveal]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (data) nav.setOptions({ title: data.reading.spread_name ?? getTool(data.reading.tool)?.name ?? "Reading" });
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
  const tool = getTool(reading.tool);
  const randomUsed = cleanRandomUsed(reading.random_source);
  const allShown = pieces.every((p) => revealed.has(p.position));

  function turnOver(position: number) {
    if (revealed!.has(position)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setRevealed(new Set([...revealed!, position]));
  }

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Title>{reading.question || reading.spread_name || tool?.name || "Reading"}</Title>
        <Muted>
          {dayTimeText(reading.created_at)}
          {oracle?.deckName ? ` · ${oracle.deckName}` : ""}
        </Muted>
        {randomUsed && randomUsed !== "device-fallback" && <Muted>{randomUsedWords(randomUsed, THIS_DEVICE)}</Muted>}
      </View>

      {randomUsed === "device-fallback" && (
        <Card>
          <Strong>random.org was not used</Strong>
          <Body>
            {chanceProblem ? `${chanceProblem} ` : "random.org could not be reached when this reading was made. "}
            The chance in this reading came from {THIS_DEVICE}'s own secure random numbers instead.
          </Body>
        </Card>
      )}

      {sensed && !sensed.skipped && (
        <Card>
          <SectionLabel>What you sensed first</SectionLabel>
          <Body>{sensed.guess}</Body>
          <Muted>
            Sealed {dayTimeText(sensed.sealed_at)}
            {sensed.confidence ? ` · ${CONFIDENCE_LABELS[sensed.confidence]}` : ""}
          </Muted>
          {sensed.fit !== null && (
            <Muted>
              Looked back: {FIT_LABELS[sensed.fit]}
              {sensed.fit_note ? `. ${sensed.fit_note}` : ""}
            </Muted>
          )}
        </Card>
      )}

      <Pieces pieces={pieces} revealed={revealed} own={own} oracle={oracle} tool={tool} spreadId={reading.spread_id} onTurn={turnOver} />
      {allShown && tool && <CastSummary tool={tool} pieces={pieces} spreadId={reading.spread_id} />}

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
          <Notes readingId={reading.id} initial={reading.notes} />
          <Predictions readingId={reading.id} rows={predictions} />
          <Tags readingId={reading.id} mine={tags.mine} all={tags.all} onChange={load} />
          <LookBackLink readingId={reading.id} waiting={!!sensed && !sensed.skipped && sensed.fit === null} entries={journal.length} />
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
function pieceName(piece: PieceRow, oracle: OracleInfo | null, tool?: ToolDef): string {
  if (oracle) return oracle.cards.get(Number(piece.piece_id))?.name ?? piece.piece_name ?? "A card you deleted";
  if (tool) return tool.piece(piece.piece_id)?.name ?? piece.piece_name ?? piece.piece_id;
  return getCardById(piece.piece_id)?.name ?? piece.piece_name ?? piece.piece_id;
}

function Pieces({ pieces, revealed, own, oracle, tool, spreadId, onTurn }: {
  pieces: PieceRow[];
  revealed: Set<number>;
  own: Map<string, string>;
  oracle: OracleInfo | null;
  tool?: ToolDef;
  spreadId: string | null;
  onTurn: (position: number) => void;
}) {
  const { width } = useWindowDimensions();
  const itemWidth = pieces.length === 1 ? width - space.lg * 2 : Math.min(width * 0.78, 420);
  const spread = spreadId ? getSpread(spreadId) : undefined;
  const cast = ichingCastOf(spreadId);
  const [wholeOpen, setWholeOpen] = useState(false);
  const renderPiece = (item: PieceRow, index: number) => (
    <PieceCard
      piece={item}
      index={index}
      total={pieces.length}
      width={itemWidth}
      shown={revealed.has(item.position)}
      own={own.get(`${item.piece_id}:${item.reversed ? "reversed" : "upright"}`)}
      oracle={oracle}
      tool={tool}
      changing={cast && item.position === 0 ? cast.values.flatMap((v, i) => (v === 6 || v === 9 ? [i + 1] : [])) : undefined}
      prompt={spread?.positions[item.position]?.description ?? (tool?.kind === "geomancy" ? geomancyHow(item.position) : undefined)}
      color={spread?.positions[item.position]?.color}
      onTurn={() => onTurn(item.position)}
    />
  );
  return (
    <>
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
        renderItem={({ item, index }) => renderPiece(item, index)}
      />
      {pieces.length > 1 && (
        <Section
          title="The whole reading"
          about={ON_WEB ? "All the cards at once. Pinch, or hold Ctrl and scroll, to zoom in and out." : "All the cards at once. Pinch to zoom in and out."}
          open={wholeOpen}
          onToggle={() => setWholeOpen(!wholeOpen)}
        >
          <WholeReading items={pieces} keyOf={(p) => String(p.position)} itemWidth={itemWidth} renderItem={renderPiece} />
        </Section>
      )}
    </>
  );
}

function PieceCard({ piece, index, total, width, shown, own, oracle, tool, changing, prompt, color, onTurn }: {
  piece: PieceRow;
  index: number;
  total: number;
  width: number;
  shown: boolean;
  own?: string;
  oracle: OracleInfo | null;
  tool?: ToolDef;
  /** I Ching: the changing lines of the first hexagram, marked beside them. */
  changing?: number[];
  prompt?: string;
  color?: string;
  onTurn: () => void;
}) {
  const t = useTokens();
  const [stock, setStock] = useState(false);
  const card = oracle || tool ? undefined : getCardById(piece.piece_id);
  const oracleCard = oracle?.cards.get(Number(piece.piece_id));
  const toolPiece = tool?.piece(piece.piece_id);
  const name = pieceName(piece, oracle, tool);
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
        {tool ? (
          toolPiece ? (
            <Glyph
              glyph={toolPiece.glyph.kind === "lines" && changing ? { ...toolPiece.glyph, changing } : toolPiece.glyph}
              size={Math.min(pictureWidth, 150)}
              faceDown={!shown}
              reversed={reversed}
            />
          ) : (
            <Glyph glyph={{ kind: "label", text: piece.piece_name ?? piece.piece_id }} size={Math.min(pictureWidth, 150)} faceDown={!shown} />
          )
        ) : oracle ? (
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
          {toolPiece?.subtitle ? <Muted style={{ textAlign: "center" }}>{toolPiece.subtitle}</Muted> : null}
          {oracleCard &&
            oracle!.fields
              .filter((f) => oracleCard.values[f.id])
              .map((f) => (
                <View key={f.id} style={{ gap: 2 }}>
                  <SectionLabel>{f.name}</SectionLabel>
                  <Body>{oracleCard.values[f.id]}</Body>
                </View>
              ))}
          {tool && !toolPiece ? null : own ? (
            <View style={{ gap: 2 }}>
              <SectionLabel>Your meaning</SectionLabel>
              <Body>{own}</Body>
            </View>
          ) : (
            <Muted>
              You have not written your own meaning for this {tool?.pieceWord ?? "card"}
              {reversed ? " reversed" : oracle || (tool && !toolPiece?.canReverse) ? "" : " upright"} yet.
            </Muted>
          )}
          {(!oracle || oracleCard) && (!tool || toolPiece) && (
            <Button
              label={own ? "Change your meaning" : "Write your meaning"}
              variant="text"
              onPress={() =>
                router.push(
                  oracle
                    ? { pathname: "/oracle/card", params: { id: piece.piece_id } }
                    : tool
                      ? { pathname: "/piece/[tool]/[id]", params: { tool: tool.id, id: piece.piece_id } }
                      : `/card/${piece.piece_id}`,
                )
              }
            />
          )}
          {tool && toolPiece && <TraditionalText tool={tool} piece={toolPiece} />}
          {!oracle && !tool && (
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

/** Under a throw, a cast or a chart: the plain sum of the dice, the coins' heads and tails, or the six lines. */
function CastSummary({ tool, pieces, spreadId }: { tool: ToolDef; pieces: PieceRow[]; spreadId: string | null }) {
  const ids = pieces.map((p) => p.piece_id);
  if (tool.kind === "throw") {
    const total = throwTotal(ids);
    const coins = coinTally(ids);
    if (pieces.length < 2 || (total === null && !coins)) return null;
    return (
      <Card>
        <Body>{total !== null ? `Total: ${total}` : `Heads: ${coins!.heads} · Tails: ${coins!.tails}`}</Body>
      </Card>
    );
  }
  if (tool.kind === "iching") {
    const cast = ichingCastOf(spreadId);
    if (!cast) return null;
    return (
      <Card>
        <SectionLabel>The six lines, from the bottom</SectionLabel>
        {cast.values.map((v, i) => (
          <Muted key={i}>
            Line {i + 1}: {v}, {ICHING_LINE_WORDS[v]}
          </Muted>
        ))}
      </Card>
    );
  }
  return null;
}

/** Looking back and the journal are on the Today tab; this opens it with this reading chosen. */
function LookBackLink({ readingId, waiting, entries }: { readingId: number; waiting: boolean; entries: number }) {
  return (
    <Card>
      <SectionLabel>Look back and journal</SectionLabel>
      <Muted>
        {waiting ? "This reading is ready to look back on. " : ""}
        {entries === 0 ? "No journal entries yet." : entries === 1 ? "It has 1 journal entry." : `It has ${entries} journal entries.`} Looking back and
        the journal are on the Today tab.
      </Muted>
      <Button label="Look back and write on Today" variant="quiet" onPress={() => router.dismissTo({ pathname: "/", params: { reading: String(readingId) } })} />
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

function Predictions({ readingId, rows }: { readingId: number; rows: PredictionRow[] }) {
  return (
    <Card>
      <SectionLabel>Predictions</SectionLabel>
      {rows.length === 0 && <Muted>What do you expect to happen? Write it down now and choose a day to look back.</Muted>}
      {rows.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/prediction/${p.id}`)}
          accessibilityRole="button"
          accessibilityHint="Opens the prediction"
          style={{ gap: 2, paddingVertical: space.xs }}
        >
          <Body>{p.text}</Body>
          <Muted>{p.outcome ? OUTCOME_LABELS[p.outcome] : p.look_back_on ? `Look back on ${dayWords(p.look_back_on)}` : "No date"}</Muted>
        </Pressable>
      ))}
      <Button
        label="Write a prediction"
        variant="quiet"
        onPress={() => router.push({ pathname: "/prediction/[id]", params: { id: "new", reading: String(readingId) } })}
      />
    </Card>
  );
}

function Tags({ readingId, mine, all, onChange }: { readingId: number; mine: TagRow[]; all: TagWithCount[]; onChange: () => void }) {
  const db = useSQLiteContext();
  const t = useTokens();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const on = new Set(mine.map((m) => m.id));
  const others = all.filter((a) => !on.has(a.id));
  const chip = (tag: TagRow, active: boolean) => (
    <Pressable
      key={tag.id}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`Tag ${tag.name}`}
      accessibilityHint={active ? "Takes the tag off this reading" : "Puts the tag on this reading"}
      onPress={async () => {
        if (active) await removeTagFromReading(db, readingId, tag.id);
        else await addTagToReading(db, readingId, tag.name);
        onChange();
      }}
      style={{
        minHeight: 40,
        paddingHorizontal: space.md,
        justifyContent: "center",
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: active ? t.blush : t.lineStrong,
        backgroundColor: active ? t.blush : "transparent",
      }}
    >
      <Muted style={{ color: active ? t.onBlush : t.ink }}>{active ? `✓ ${tag.name}` : tag.name}</Muted>
    </Pressable>
  );
  return (
    <Card>
      <SectionLabel>Tags</SectionLabel>
      {mine.length === 0 && <Muted>Tags let you find readings again, such as "work" or "family".</Muted>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {mine.map((m) => chip(m, true))}
        {others.map((o) => chip(o, false))}
      </View>
      <Field
        label="New tag"
        value={draft}
        onChangeText={(v) => (setDraft(v), setError(null))}
        maxLength={MAX_TAG_LENGTH}
        autoCapitalize="none"
        returnKeyType="done"
      />
      <Button
        label="Add the tag"
        variant="quiet"
        disabled={!draft.trim()}
        onPress={async () => {
          const name = cleanTagName(draft);
          if (!name) return setError(`A tag can be up to ${MAX_TAG_LENGTH} characters.`);
          await addTagToReading(db, readingId, name);
          setDraft("");
          onChange();
        }}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
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
              cards: pieces.map((p) => ({ position: p.position_name, card_name: pieceName(p, oracle, getTool(reading.tool)), reversed: !!p.reversed })),
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
          Alert.alert("Delete this reading?", `Its cards, what you sensed, its notes, journal entries and predictions are deleted from ${THIS_DEVICE}. This cannot be undone.`, [
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
