// The person's tags: rename one (renaming it to another tag's name joins them) or delete it. Readings are never
// deleted here; a deleted tag only comes off them.

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { MAX_TAG_LENGTH, deleteTag, listTags, renameTag, type TagWithCount } from "../db/predictions";
import { Button, Card, ErrorNote, Field, Loading, Muted, Screen, Strong } from "../ui/kit";

export default function Tags() {
  const db = useSQLiteContext();
  const [tags, setTags] = useState<TagWithCount[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setTags(await listTags(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!tags) return <Loading />;

  return (
    <Screen>
      {tags.length === 0 && <Muted>You have no tags yet. Add one from any reading, under Tags.</Muted>}
      {tags.map((t) => (
        <Card key={t.id}>
          {editing === t.id ? (
            <>
              <Field label="Tag name" value={draft} onChangeText={(v) => (setDraft(v), setError(null))} maxLength={MAX_TAG_LENGTH} autoFocus />
              <Muted>Renaming it to the name of another tag puts the two together.</Muted>
              <Button
                label="Save the name"
                onPress={async () => {
                  try {
                    await renameTag(db, t.id, draft);
                    setEditing(null);
                    load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
              <Button label="Cancel" variant="text" onPress={() => (setEditing(null), setError(null))} />
              {error && <ErrorNote>{error}</ErrorNote>}
            </>
          ) : (
            <>
              <Strong>{t.name}</Strong>
              <Muted>
                On {t.readings} {t.readings === 1 ? "reading" : "readings"}
              </Muted>
              <Button label="Rename" variant="quiet" onPress={() => (setEditing(t.id), setDraft(t.name), setError(null))} />
              <Button
                label="Delete the tag"
                variant="text"
                onPress={() =>
                  Alert.alert(`Delete the tag "${t.name}"?`, "The readings stay; only the tag comes off them.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: async () => (await deleteTag(db, t.id), load()) },
                  ])
                }
              />
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
