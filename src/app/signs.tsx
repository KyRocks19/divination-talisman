// Signs and dreams: a log of what the person noticed or dreamed. The app gives no meaning to either.

import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { MAX_NOTE_CHARS, NOTE_KINDS, NOTE_WORDS, SIGN_WORDS, cleanNoteBody, type NoteKind } from "../core/practice";
import { addNote, listNotes, type NoteRow } from "../db/notes";
import { dayTimeText } from "../lib/dates";
import { Body, Button, Card, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen, SectionLabel } from "../ui/kit";

export default function Signs() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<NoteRow[] | null>(null);
  const [kind, setKind] = useState<NoteKind>("sign");
  const [body, setBody] = useState("");
  const [show, setShow] = useState<NoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filter: NoteKind | null) => setRows(await listNotes(db, filter)), [db]);
  useFocusEffect(
    useCallback(() => {
      load(show);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (!rows) return <Loading />;

  return (
    <Screen>
      <Muted>{SIGN_WORDS}</Muted>
      <Card>
        <ChoiceRow
          label="This is"
          options={NOTE_KINDS.map((k) => ({ value: k, label: NOTE_WORDS[k].label }))}
          value={kind}
          onChange={(v) => v && setKind(v)}
        />
        <Field label={NOTE_WORDS[kind].prompt} value={body} onChangeText={(v) => (setBody(v), setError(null))} multiline maxLength={MAX_NOTE_CHARS} />
        <Button
          label="Save"
          disabled={!body.trim()}
          onPress={async () => {
            const c = cleanNoteBody(body);
            if (!c.ok) return setError(c.error);
            await addNote(db, kind, c.text);
            setBody("");
            load(show);
          }}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
      </Card>

      {rows.length > 0 || show ? (
        <ChoiceRow
          label="Show"
          options={NOTE_KINDS.map((k) => ({ value: k, label: `Only ${NOTE_WORDS[k].plural.toLowerCase()}` }))}
          value={show}
          onChange={(v) => {
            setShow(v);
            load(v);
          }}
          allowNone
        />
      ) : null}
      {rows.length === 0 && <Muted>{show ? `No ${NOTE_WORDS[show].plural.toLowerCase()} yet.` : "Nothing written yet."}</Muted>}
      {rows.length > 0 && <SectionLabel>{show ? NOTE_WORDS[show].plural : "Signs and dreams"}</SectionLabel>}
      {rows.map((n) => (
        <Card key={n.id} onPress={() => router.push(`/note/${n.id}`)} accessibilityHint="Opens it to change or delete">
          <Muted>
            {NOTE_WORDS[n.kind as NoteKind]?.label ?? n.kind} · {dayTimeText(n.created_at)}
          </Muted>
          <Body numberOfLines={4}>{n.body}</Body>
        </Card>
      ))}
    </Screen>
  );
}
