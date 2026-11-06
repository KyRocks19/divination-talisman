// One sign or dream: change its words, or delete it.

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { MAX_NOTE_CHARS, NOTE_KINDS, NOTE_WORDS, isNoteKind, type NoteKind } from "../../core/practice";
import { deleteNote, getNote, updateNote, type NoteRow } from "../../db/notes";
import { dayTimeText } from "../../lib/dates";
import { Body, Button, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen } from "../../ui/kit";

export default function NoteScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<NoteRow | null | undefined>(undefined);
  const [kind, setKind] = useState<NoteKind>("sign");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getNote(db, Number(id)).then((r) => {
        setRow(r);
        if (r && isNoteKind(r.kind)) {
          setKind(r.kind);
          setBody(r.body);
        }
      });
    }, [db, id]),
  );

  if (row === undefined) return <Loading />;
  if (!row || !isNoteKind(row.kind)) {
    return (
      <Screen>
        <Body>This note is no longer here.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Muted>Written {dayTimeText(row.created_at)}</Muted>
      <ChoiceRow label="This is" options={NOTE_KINDS.map((k) => ({ value: k, label: NOTE_WORDS[k].label }))} value={kind} onChange={(v) => v && (setKind(v), setSaved(false))} />
      <Field label={NOTE_WORDS[kind].prompt} value={body} onChangeText={(v) => (setBody(v), setSaved(false), setError(null))} multiline maxLength={MAX_NOTE_CHARS} />
      <Button
        label={saved ? "Saved" : "Save changes"}
        disabled={saved}
        onPress={async () => {
          try {
            await updateNote(db, row.id, kind, body);
            setSaved(true);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button
        label="Delete it"
        variant="danger"
        onPress={() =>
          Alert.alert("Delete this note?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => (await deleteNote(db, row.id), router.back()) },
          ])
        }
      />
    </Screen>
  );
}
