// One prediction: write it, reword it, move its look-back day, and when the day comes, say what happened.
// /prediction/new?reading=ID writes a new one for that reading; /prediction/new alone writes one on its own.

import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  LOOK_BACK_CHOICES, MAX_PREDICTION_LENGTH, OUTCOMES, OUTCOME_LABELS, cleanPredictionText, dayAfter, dayWords, localDay,
  predictionState, type Outcome,
} from "../../core/predictions";
import { addPrediction, deletePrediction, getPrediction, setOutcome, updatePrediction, type PredictionListItem } from "../../db/predictions";
import { dayText, dayTimeText } from "../../lib/dates";
import { REMINDERS_AVAILABLE, syncReminders } from "../../lib/reminders";
import { Body, Button, Card, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";

/** The look-back choice as a ChoiceRow value: a number of days, "none", or "kept" for the day it already has. */
type DayChoice = string;

function dayFromChoice(choice: DayChoice, kept: string | null, from: Date): string | null {
  if (choice === "kept") return kept;
  if (choice === "none") return null;
  return dayAfter(from, Number(choice));
}

export default function PredictionScreen() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const params = useLocalSearchParams<{ id: string; reading?: string }>();
  const isNew = params.id === "new";
  const readingId = params.reading ? Number(params.reading) : null;
  const [p, setP] = useState<PredictionListItem | null | undefined>(isNew ? null : undefined);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<DayChoice>("7");
  const [outcome, setOutcomeValue] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew) return;
    const row = await getPrediction(db, Number(params.id));
    setP(row);
    if (row) {
      setText(row.text);
      setChoice(row.look_back_on ? "kept" : "none");
      setOutcomeValue(row.outcome);
      setNote(row.outcome_note ?? "");
    }
  }, [db, isNew, params.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    nav.setOptions({ title: isNew ? "New prediction" : "Prediction" });
  }, [isNew, nav]);

  if (p === undefined) return <Loading />;
  if (!isNew && p === null) {
    return (
      <Screen>
        <Body>This prediction has been deleted.</Body>
      </Screen>
    );
  }

  const today = localDay(new Date());
  const state = p ? predictionState(p, today) : null;
  const open = !p?.outcome;
  const kept = p?.look_back_on ?? null;
  const dayOptions = [
    ...(kept ? [{ value: "kept", label: `On ${dayWords(kept)}` }] : []),
    ...LOOK_BACK_CHOICES.map((c) => ({ value: c.days === null ? "none" : String(c.days), label: c.label })),
  ];
  const chosenDay = dayFromChoice(choice, kept, new Date());

  async function afterChange(ask: boolean) {
    const ok = await syncReminders(db, { ask });
    if (ask && !ok && REMINDERS_AVAILABLE && chosenDay) {
      setMessage("Saved. The phone is not allowing reminders for this app, so look for it on the Today screen. You can allow reminders in the phone's settings.");
    }
  }

  async function save() {
    setError(null);
    setMessage(null);
    const c = cleanPredictionText(text);
    if (!c.ok) return setError(c.error);
    try {
      if (isNew) {
        const id = await addPrediction(db, readingId, c.text, chosenDay);
        await afterChange(!!chosenDay);
        router.replace(`/prediction/${id}`);
        return;
      }
      await updatePrediction(db, p!.id, c.text, chosenDay);
      await afterChange(!!chosenDay && chosenDay !== kept);
      await load();
      setMessage((m) => m ?? "Saved.");
    } catch (e) {
      setError(`It could not be saved: ${(e as Error).message}`);
    }
  }

  async function saveOutcome(value: Outcome | null) {
    setError(null);
    setMessage(null);
    await setOutcome(db, p!.id, value, value === null ? null : note);
    await syncReminders(db);
    await load();
    setMessage(value === null ? "Your answer is taken back. The prediction is open again." : "Saved.");
  }

  return (
    <Screen>
      {p?.reading_id && (
        <Card onPress={() => router.push(`/reading/${p.reading_id}`)} accessibilityHint="Opens the reading">
          <Muted>From the reading</Muted>
          <Strong>{p.reading_title || "Reading"}</Strong>
          {p.reading_at ? <Muted>{dayText(p.reading_at)}</Muted> : null}
        </Card>
      )}

      {open ? (
        <Card>
          <Field
            label="What do you expect to happen?"
            value={text}
            onChangeText={(v) => (setText(v), setError(null))}
            multiline
            maxLength={MAX_PREDICTION_LENGTH}
            autoFocus={isNew}
            placeholder="Something you will be able to look back on"
          />
          {p?.original_text && p.original_text !== p.text && (
            <View style={{ gap: 2 }}>
              <SectionLabel>What you first wrote</SectionLabel>
              <Body>{p.original_text}</Body>
              <Muted>The first words are kept as they were, so you can see how your view changed.</Muted>
            </View>
          )}
          <ChoiceRow label="When do you want to look back?" options={dayOptions} value={choice} onChange={(v) => v && setChoice(v)} />
          <Muted>
            {chosenDay
              ? REMINDERS_AVAILABLE
                ? `On ${dayWords(chosenDay)} the phone reminds you, if reminders are on in Me. The reminder does not show your words.`
                : `On ${dayWords(chosenDay)} it is listed on the Today screen.`
              : "With no date, it waits in your list of predictions."}
          </Muted>
          <Button label={isNew ? "Save the prediction" : "Save changes"} onPress={save} />
        </Card>
      ) : (
        <Card>
          <SectionLabel>What you expected</SectionLabel>
          <Body>{p!.text}</Body>
          {p!.original_text && p!.original_text !== p!.text && <Muted>First written: {p!.original_text}</Muted>}
          <Muted>Written {dayTimeText(p!.created_at)}</Muted>
        </Card>
      )}

      {p && (
        <Card>
          <SectionLabel>Looking back</SectionLabel>
          {state === "waiting" && <Muted>The day you chose is {dayWords(p.look_back_on!)}. You can look back sooner if you already know.</Muted>}
          {state === "due" && <Muted>The day has come. When you know, say what happened. There is no right answer.</Muted>}
          <ChoiceRow
            label="What happened?"
            options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABELS[o] }))}
            value={outcome}
            onChange={setOutcomeValue}
            allowNone
          />
          <Field label="In your words (optional)" value={note} onChangeText={setNote} multiline maxLength={2000} />
          {p.looked_back_at && <Muted>You looked back on {dayTimeText(p.looked_back_at)}.</Muted>}
          <Button
            label="Save what happened"
            disabled={outcome === null || (outcome === p.outcome && (note.trim() || null) === (p.outcome_note ?? null))}
            onPress={() => saveOutcome(outcome)}
          />
          {p.outcome && <Button label="Take back my answer" variant="text" onPress={() => saveOutcome(null)} />}
        </Card>
      )}

      {message && <Body accessibilityLiveRegion="polite">{message}</Body>}
      {error && <ErrorNote>{error}</ErrorNote>}

      {p && (
        <Button
          label="Delete this prediction"
          variant="danger"
          onPress={() =>
            Alert.alert("Delete this prediction?", "Its words and what you said happened are deleted. This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  await deletePrediction(db, p.id);
                  await syncReminders(db);
                  router.back();
                },
              },
            ])
          }
        />
      )}
    </Screen>
  );
}
