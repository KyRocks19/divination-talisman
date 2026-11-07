import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BUILT_IN_SPREADS } from "../../core/spreads";
import { listDecks, type Deck } from "../../db/oracle";
import { getTextSetting, setTextSetting } from "../../db/queries";
import { TOOLS } from "../../core/tools";
import { ALL_TOOLS, showsPart, toolPickOptions, type ToolPick } from "../../core/tool-picker";
import { Button, Card, Dropdown, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";

const TOOLS_PICK_KEY = "toolsPick";

export default function Tools() {
  const db = useSQLiteContext();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [pick, setPick] = useState<ToolPick>(ALL_TOOLS);
  // The last pick is kept with the other settings, so the page opens where the person left it.
  useEffect(() => {
    getTextSetting(db, TOOLS_PICK_KEY).then((saved) => {
      if (saved) setPick(saved);
    });
  }, [db]);
  const choose = (next: ToolPick) => {
    setPick(next);
    setTextSetting(db, TOOLS_PICK_KEY, next);
  };
  const shows = (part: ToolPick) => showsPart(pick, part);
  const otherTools = TOOLS.filter((tool) => shows(tool.id));

  useFocusEffect(
    useCallback(() => {
      listDecks(db).then(setDecks);
    }, [db]),
  );

  return (
    <Screen>
      <Dropdown label="Show" options={toolPickOptions()} value={pick} onChange={choose} />

      {shows("tarot") && (
        <>
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
      {pick === "tarot" && (
        <Card onPress={() => router.push("/library")} accessibilityHint="Opens the 78 cards">
          <Strong>Card library</Strong>
          <Muted>All 78 tarot cards, with your own meanings first.</Muted>
        </Card>
      )}
        </>
      )}

      {shows("oracle") && (
        <>
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
        </>
      )}

      {otherTools.length > 1 && <SectionLabel>Other tools</SectionLabel>}
      {otherTools.length > 1 &&
        otherTools.map((tool) => (
          <Card key={tool.id} onPress={() => router.push(`/tool/${tool.id}`)} accessibilityHint="Opens the tool, with your meanings">
            <Strong>{tool.name}</Strong>
            <Muted>{tool.blurb}</Muted>
          </Card>
        ))}
      {otherTools.length === 1 && (
        <>
          <SectionLabel>{otherTools[0].name}</SectionLabel>
          <Muted>{otherTools[0].blurb}</Muted>
          <Button
            label="Start a reading"
            onPress={() => router.push({ pathname: "/reading/new", params: { tool: otherTools[0].id } })}
          />
          <Card onPress={() => router.push(`/tool/${otherTools[0].id}`)} accessibilityHint="Opens the tool, with your meanings">
            <Strong>Your meanings</Strong>
            <Muted>
              Write what each {otherTools[0].pieceWord} means to you, and see where the app's words come from.
            </Muted>
          </Card>
        </>
      )}

      {shows("practice") && (
        <>
      <SectionLabel>Practice and notes</SectionLabel>
      <Card onPress={() => router.push("/signs")} accessibilityHint="Opens your signs and dreams">
        <Strong>Signs and dreams</Strong>
        <Muted>Write down a sign you noticed or a dream you had, to look back on later.</Muted>
      </Card>
      <Card onPress={() => router.push("/blind")} accessibilityHint="Opens blind-target practice">
        <Strong>Blind-target practice</Strong>
        <Muted>Write an impression of a hidden target, then see which of four it was.</Muted>
      </Card>
        </>
      )}

      {pick === ALL_TOOLS && (
        <>
          <SectionLabel>Learn</SectionLabel>
          <Card onPress={() => router.push("/library")} accessibilityHint="Opens the 78 cards">
            <Strong>Card library</Strong>
            <Muted>All 78 tarot cards, with your own meanings first.</Muted>
          </Card>
        </>
      )}
    </Screen>
  );
}
