// The journal, on the Today tab: entries about the reading chosen there, or, with no reading, the person's own
// journal. Every entry can be changed and deleted.

import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { addJournalEntry, deleteJournalEntry, listJournal, updateJournalEntry, type JournalRow } from "../db/queries";
import { dayText } from "../lib/dates";
import { Body, Button, Card, Field, Muted, SectionLabel } from "./kit";
import { space } from "./theme";

const MAX_ENTRY = 5000;

export function Journal({ readingId, about }: { readingId: number | null; about: string | null }) {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<JournalRow[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);

  const load = useCallback(async () => setEntries(await listJournal(db, readingId)), [db, readingId]);
  useEffect(() => {
    setEditing(null);
    load();
  }, [load]);

  return (
    <Card>
      <SectionLabel>Journal</SectionLabel>
      <Muted>
        {about
          ? `Entries about “${about}”. Add more over the coming days as things unfold.`
          : "Your own journal, not about any one reading. To write about a reading, choose it above."}
      </Muted>
      <Field label="New entry" value={draft} onChangeText={setDraft} multiline maxLength={MAX_ENTRY} />
      <Button
        label="Add entry"
        variant="quiet"
        disabled={!draft.trim()}
        onPress={async () => {
          await addJournalEntry(db, readingId, draft);
          setDraft("");
          load();
        }}
      />
      {entries.length === 0 && <Muted>No entries yet.</Muted>}
      {entries.map((e) =>
        editing?.id === e.id ? (
          <View key={e.id} style={{ gap: space.sm }}>
            <Field label={`Entry from ${dayText(e.created_at)}`} value={editing.body} onChangeText={(body) => setEditing({ id: e.id, body })} multiline maxLength={MAX_ENTRY} />
            <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
              <Button
                label="Save the change"
                disabled={!editing.body.trim()}
                onPress={async () => {
                  await updateJournalEntry(db, e.id, editing.body);
                  setEditing(null);
                  load();
                }}
              />
              <Button label="Cancel" variant="text" onPress={() => setEditing(null)} />
            </View>
          </View>
        ) : (
          <View key={e.id} style={{ gap: 2 }}>
            <Muted>
              {dayText(e.created_at)}
              {e.updated_at !== e.created_at ? " (changed)" : ""}
            </Muted>
            <Body>{e.body}</Body>
            <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
              <Button label="Change" variant="text" onPress={() => setEditing({ id: e.id, body: e.body })} />
              <Button
                label="Delete"
                variant="text"
                accessibilityHint="Deletes this entry"
                onPress={() =>
                  Alert.alert("Delete this entry?", "This cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: async () => (await deleteJournalEntry(db, e.id), load()) },
                  ])
                }
              />
            </View>
          </View>
        ),
      )}
    </Card>
  );
}
