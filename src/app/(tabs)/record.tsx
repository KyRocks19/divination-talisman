// Record: every reading on the phone, newest first, with search, and the way into Patterns.

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../../core/cards";
import { listReadings, PIECE_NAME_SEPARATOR, type ReadingListItem } from "../../db/queries";
import { dayText } from "../../lib/dates";
import { Body, Button, Card, Field, Muted, Screen, Strong } from "../../ui/kit";
import { HERE } from "../../lib/where";

export default function Record() {
  const db = useSQLiteContext();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReadingListItem[] | null>(null);

  const load = useCallback(async (q: string) => setRows(await listReadings(db, q)), [db]);

  useFocusEffect(
    useCallback(() => {
      load(search);
      // Only reload on focus; typing reloads through onChangeText.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  return (
    <Screen>
      <Button label="Patterns" variant="quiet" onPress={() => router.push("/patterns")} accessibilityHint="Counts across all your readings" />
      <Field
        label="Search your readings"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          load(v);
        }}
        placeholder="A word from a question, a note or what you sensed"
        returnKeyType="search"
        autoCorrect={false}
      />
      {rows && rows.length === 0 && (
        <Muted>{search.trim() ? "No reading has those words." : `Your readings will be listed here. They are kept only ${HERE}.`}</Muted>
      )}
      {rows?.map((r) => {
        const ids = (r.piece_ids ?? "").split(",").filter(Boolean);
        const kept = (r.piece_names ?? "").split(PIECE_NAME_SEPARATOR);
        const names = ids.map((id, i) => (r.tool === "tarot" ? getCardById(id)?.name : undefined) ?? (kept[i] || "A card"));
        return (
          <Card key={r.id} onPress={() => router.push(`/reading/${r.id}`)} accessibilityHint="Opens the reading">
            <Strong>{r.question || r.spread_name || "Reading"}</Strong>
            <Muted>
              {dayText(r.created_at)}
              {r.spread_name ? ` · ${r.spread_name}` : ""}
            </Muted>
            {names.length > 0 && <Body numberOfLines={2}>{names.join(", ")}</Body>}
          </Card>
        );
      })}
    </Screen>
  );
}
