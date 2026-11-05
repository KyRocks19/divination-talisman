// Record: every reading on the phone, newest first, with search, and the way into Patterns.

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCardById } from "../../core/cards";
import { listReadings, type ReadingListItem } from "../../db/queries";
import { dayText } from "../../lib/dates";
import { Body, Button, Card, Field, Muted, Screen, Strong } from "../../ui/kit";

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
        <Muted>{search.trim() ? "No reading has those words." : "Your readings will be listed here. They are kept only on this phone."}</Muted>
      )}
      {rows?.map((r) => {
        const names = (r.piece_ids ?? "")
          .split(",")
          .filter(Boolean)
          .map((id) => getCardById(id)?.name ?? id);
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
