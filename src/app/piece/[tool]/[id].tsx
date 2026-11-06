// One piece of a tool (a rune, an ogham letter, a playing card, a die's face, a hexagram, a geomancy figure): the
// person's own meanings first, each with its earlier versions; the tool's traditional text behind its own button.

import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getTool } from "../../../core/tools";
import { getMeanings, type MeaningRow, type Orientation } from "../../../db/queries";
import { OwnMeaning } from "../../../ui/OwnMeaning";
import { Glyph } from "../../../ui/Glyph";
import { TraditionalText } from "../../../ui/TraditionalText";
import { Body, Muted, Screen, Strong } from "../../../ui/kit";
import { HERE } from "../../../lib/where";

export default function PieceScreen() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const { tool: toolId, id } = useLocalSearchParams<{ tool: string; id: string }>();
  const tool = getTool(toolId);
  const piece = tool?.piece(id);
  const [meanings, setMeanings] = useState<Partial<Record<Orientation, MeaningRow>>>({});

  const load = useCallback(async () => setMeanings(await getMeanings(db, toolId, id)), [db, toolId, id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    if (piece) nav.setOptions({ title: piece.name });
  }, [piece, nav]);

  if (!tool || !piece) {
    return (
      <Screen>
        <Body>This is not part of the app's tools.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Glyph glyph={piece.glyph} size={120} label={piece.name} />
        <Strong>{piece.name}</Strong>
        {piece.subtitle ? <Muted style={{ textAlign: "center" }}>{piece.subtitle}</Muted> : null}
      </View>
      <Muted style={{ textAlign: "center" }}>Your words come first. They are kept {HERE}, and every earlier version is kept too.</Muted>
      <OwnMeaning
        tool={tool.id}
        pieceId={piece.id}
        orientation="upright"
        row={meanings.upright}
        onSaved={load}
        label={piece.canReverse ? "Your meaning, upright" : "Your meaning"}
        placeholder={`What does this ${tool.pieceWord} mean to you?`}
      />
      {piece.canReverse && (
        <OwnMeaning
          tool={tool.id}
          pieceId={piece.id}
          orientation="reversed"
          row={meanings.reversed}
          onSaved={load}
          placeholder={`What does this ${tool.pieceWord} mean to you reversed?`}
        />
      )}
      <TraditionalText tool={tool} piece={piece} />
    </Screen>
  );
}
