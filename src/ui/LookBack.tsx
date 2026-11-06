// Looking back on what the person sensed first, once they know how things went. On the Today tab, for whichever
// reading the person chooses there. Never scored: the person says how well it fitted, in their own words if they like.

import { useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { FITS, FIT_LABELS, MAX_FIT_NOTE_LENGTH, type Fit } from "../core/guess-core";
import { setFit } from "../db/queries";
import { Button, Card, ChoiceRow, Field, Muted, SectionLabel } from "./kit";

export function LookBack({ readingId, fit, note, onSaved }: { readingId: number; fit: Fit | null; note: string | null; onSaved: () => void }) {
  const db = useSQLiteContext();
  const [value, setValue] = useState<Fit | null>(fit);
  const [words, setWords] = useState(note ?? "");
  const [saved, setSaved] = useState(false);
  const changed = value !== fit || (words.trim() || null) !== (note ?? null);
  return (
    <Card>
      <SectionLabel>Looking back</SectionLabel>
      <Muted>
        When you know how things went, say how well what you sensed fitted. There is no right answer; this is for you to notice your own
        patterns.
      </Muted>
      <ChoiceRow
        label="How well did it fit?"
        options={FITS.map((f) => ({ value: f, label: FIT_LABELS[f] }))}
        value={value}
        onChange={(v) => {
          setValue(v);
          setSaved(false);
        }}
        allowNone
      />
      <Field label="A note (optional)" value={words} onChangeText={(v) => (setWords(v), setSaved(false))} multiline maxLength={MAX_FIT_NOTE_LENGTH} />
      <Button
        label={saved ? "Saved" : "Save"}
        disabled={!changed && !saved}
        onPress={async () => {
          await setFit(db, readingId, value, value === null ? null : words);
          setSaved(true);
          onSaved();
        }}
      />
    </Card>
  );
}
