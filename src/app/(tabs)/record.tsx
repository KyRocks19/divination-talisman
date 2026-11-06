// Record: every reading on the phone, newest first, with search and a tag filter, and the ways into Patterns,
// Predictions and Tags.

import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../../core/cards";
import { toolName } from "../../core/tools";
import { listReadings, PIECE_NAME_SEPARATOR, type ReadingListItem } from "../../db/queries";
import { listTags, type TagWithCount } from "../../db/predictions";
import { dayText } from "../../lib/dates";
import { Body, Button, Card, ChoiceRow, Field, Muted, Screen, Strong } from "../../ui/kit";
import { space } from "../../ui/theme";
import { HERE } from "../../lib/where";

export default function Record() {
  const db = useSQLiteContext();
  const [search, setSearch] = useState("");
  const [tagId, setTagId] = useState<number | null>(null);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [rows, setRows] = useState<ReadingListItem[] | null>(null);

  const load = useCallback(async (q: string, tag: number | null) => setRows(await listReadings(db, q, 200, tag)), [db]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = (await listTags(db)).filter((t) => t.readings > 0);
        setTags(all);
        // A tag deleted elsewhere stops filtering.
        const tag = tagId !== null && all.some((t) => t.id === tagId) ? tagId : null;
        setTagId(tag);
        load(search, tag);
      })();
      // Only reload on focus; typing and tapping reload through their own handlers.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  return (
    <Screen>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button label="Patterns" variant="quiet" onPress={() => router.push("/patterns")} accessibilityHint="Counts across all your readings" />
        <Button label="Predictions" variant="quiet" onPress={() => router.push("/predictions")} accessibilityHint="What you expected, and looking back" />
        <Button label="Tags" variant="quiet" onPress={() => router.push("/tags")} accessibilityHint="Rename or delete your tags" />
      </View>
      <Field
        label="Search your readings"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          load(v, tagId);
        }}
        placeholder="A word from a question, a note, a tag or what you sensed"
        returnKeyType="search"
        autoCorrect={false}
      />
      {tags.length > 0 && (
        <ChoiceRow
          label="Only readings tagged"
          options={tags.map((t) => ({ value: t.id, label: `${t.name} (${t.readings})` }))}
          value={tagId}
          onChange={(v) => {
            setTagId(v);
            load(search, v);
          }}
          allowNone
        />
      )}
      {rows && rows.length === 0 && (
        <Muted>
          {search.trim() || tagId !== null ? "No reading matches." : `Your readings will be listed here. They are kept only ${HERE}.`}
        </Muted>
      )}
      {rows?.map((r) => {
        const ids = (r.piece_ids ?? "").split(",").filter(Boolean);
        const kept = (r.piece_names ?? "").split(PIECE_NAME_SEPARATOR);
        const names = ids.map((id, i) => (r.tool === "tarot" ? getCardById(id)?.name : undefined) ?? (kept[i] || "A piece"));
        return (
          <Card key={r.id} onPress={() => router.push(`/reading/${r.id}`)} accessibilityHint="Opens the reading">
            <Strong>{r.question || r.spread_name || "Reading"}</Strong>
            <Muted>
              {dayText(r.created_at)}
              {r.tool !== "tarot" && r.tool !== "oracle" ? ` · ${toolName(r.tool)}` : ""}
              {r.spread_name ? ` · ${r.spread_name}` : ""}
            </Muted>
            {names.length > 0 && <Body numberOfLines={2}>{names.join(", ")}</Body>}
          </Card>
        );
      })}
    </Screen>
  );
}
