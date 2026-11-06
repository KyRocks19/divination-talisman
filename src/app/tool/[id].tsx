// One tool's page: start a reading with it, every piece with the person's own meanings, and where the app's words
// and shapes come from.

import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getTool } from "../../core/tools";
import { allMeanings } from "../../db/queries";
import { Glyph } from "../../ui/Glyph";
import { Body, Button, Card, Muted, Screen, SectionLabel } from "../../ui/kit";
import { space, useTokens } from "../../ui/theme";

const COLUMNS = 4;

export default function ToolScreen() {
  const db = useSQLiteContext();
  const t = useTokens();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = getTool(id);
  const [own, setOwn] = useState<Map<string, string>>(new Map());
  const [sources, setSources] = useState(false);

  useEffect(() => {
    if (tool) nav.setOptions({ title: tool.name });
  }, [tool, nav]);
  useFocusEffect(
    useCallback(() => {
      if (tool) allMeanings(db, tool.id).then(setOwn);
    }, [db, tool]),
  );

  if (!tool) {
    return (
      <Screen>
        <Body>This tool is not in the app.</Body>
      </Screen>
    );
  }
  const size = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;
  const pieces = tool.pieces();
  const written = pieces.filter((p) => own.has(`${p.id}:upright`) || own.has(`${p.id}:reversed`)).length;

  return (
    <Screen>
      <Body>{tool.blurb}</Body>
      <Button label="Start a reading" onPress={() => router.push({ pathname: "/reading/new", params: { tool: tool.id } })} />

      {pieces.length > 0 && (
        <>
      <SectionLabel>
        Your meanings ({written} of {pieces.length})
      </SectionLabel>
      <Muted>Tap a {tool.pieceWord} to write what it means to you. Every earlier version is kept.</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        {pieces.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: "/piece/[tool]/[id]", params: { tool: tool.id, id: p.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${own.has(`${p.id}:upright`) ? ", your meaning written" : ""}`}
            style={({ pressed }) => ({ width: size, gap: space.xs, opacity: pressed ? 0.8 : 1 })}
          >
            <Glyph glyph={p.glyph} size={size} />
            <Text style={{ color: t.ink, fontSize: 13, textAlign: "center" }} numberOfLines={2}>
              {own.has(`${p.id}:upright`) ? "✓ " : ""}
              {p.name}
            </Text>
          </Pressable>
        ))}
      </View>
        </>
      )}

      <Button label={sources ? "Hide where this comes from" : "Where this comes from"} variant="quiet" onPress={() => setSources(!sources)} />
      {sources && (
        <Card>
          {tool.sources.map((s, i) => (
            <Muted key={i}>{s}</Muted>
          ))}
        </Card>
      )}
    </Screen>
  );
}
