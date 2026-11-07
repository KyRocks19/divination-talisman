// One blind-target trial, step by step. /blind/new: write the four targets and hide them. Then: write the impression
// and seal it; then choose which target it matches; then the target is shown. The target is never on screen before
// the choice is saved.

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BLIND_WORDS, MAX_IMPRESSION_CHARS, MAX_OPTION_CHARS, OPTION_COUNT, cleanOptions, trialState } from "../../core/practice";
import { chooseOption, deleteNote, getTrial, sealImpression, startTrial, type TrialRow } from "../../db/notes";
import { dayTimeText } from "../../lib/dates";
import { drawWithSetting } from "../../lib/random";
import { getSettings } from "../../db/queries";
import { randomUsedWords } from "../../core/random-source";
import { THIS_DEVICE } from "../../lib/where";
import { Body, Button, Card, ChoiceRow, ErrorNote, Field, Loading, Muted, Screen, SectionLabel, Strong, Title } from "../../ui/kit";

export default function TrialScreen() {
  const db = useSQLiteContext();
  const { id, chanceProblem } = useLocalSearchParams<{ id: string; chanceProblem?: string }>();
  const isNew = id === "new";
  const [row, setRow] = useState<TrialRow | null | undefined>(isNew ? null : undefined);
  const [options, setOptions] = useState<string[]>(Array(OPTION_COUNT).fill(""));
  const [impression, setImpression] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isNew) setRow(await getTrial(db, Number(id)));
  }, [db, id, isNew]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (row === undefined) return <Loading />;
  if (!isNew && row === null) {
    return (
      <Screen>
        <Body>This trial is no longer here.</Body>
      </Screen>
    );
  }

  const act = async (f: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  if (isNew) {
    return (
      <Screen>
        <Title>Four targets</Title>
        <Muted>{BLIND_WORDS.blind}</Muted>
        {options.map((o, i) => (
          <Field
            key={i}
            label={`Target ${i + 1}`}
            value={o}
            onChangeText={(v) => (setOptions(options.map((x, j) => (j === i ? v : x))), setError(null))}
            maxLength={MAX_OPTION_CHARS}
            placeholder={["A red apple", "The sea at night", "A city bus", "An old oak"][i]}
          />
        ))}
        <Button
          label="Hide them and pick one"
          disabled={busy}
          onPress={() =>
            act(async () => {
              const c = cleanOptions(options);
              if (!c.ok) throw new Error(c.error);
              // One number from the source of chance chosen in Settings picks the target.
              const drawn = await drawWithSetting((await getSettings(db)).randomSource, (rng) => rng());
              const newId = await startTrial(db, c.options, () => drawn.result, drawn.used);
              router.replace({ pathname: "/blind/[id]", params: { id: String(newId), ...(drawn.problem ? { chanceProblem: drawn.problem } : {}) } });
            })
          }
        />
        {error && <ErrorNote>{error}</ErrorNote>}
      </Screen>
    );
  }

  const r = row!;
  const state = trialState(r.trial);

  return (
    <Screen>
      {state === "open" && (
        <>
          <Title>Your impression</Title>
          <Body>One of the four targets has been picked by chance and is hidden. Before you see the four, write what comes to you: shapes, colours, feelings, words.</Body>
          {r.trial.randomSource === "device-fallback" ? (
            <Card>
              <Strong>random.org was not used</Strong>
              <Body>
                {chanceProblem ? `${chanceProblem} ` : "random.org could not be reached when this trial was started. "}
                The target was picked with {THIS_DEVICE}'s own secure random numbers instead.
              </Body>
            </Card>
          ) : r.trial.randomSource ? (
            <Muted>{randomUsedWords(r.trial.randomSource, THIS_DEVICE)}</Muted>
          ) : null}
          <Field label="What do you sense?" value={impression} onChangeText={(v) => (setImpression(v), setError(null))} multiline maxLength={MAX_IMPRESSION_CHARS} autoFocus />
          <Button label="Seal it" disabled={busy || !impression.trim()} onPress={() => act(async () => (await sealImpression(db, r.id, impression), await load()))} />
        </>
      )}

      {state !== "open" && (
        <Card>
          <SectionLabel>Your impression</SectionLabel>
          <Body>{r.impression}</Body>
          <Muted>Sealed {dayTimeText(r.trial.sealedAt!)}</Muted>
        </Card>
      )}

      {state === "sealed" && (
        <>
          <ChoiceRow
            label="Which target does it match best?"
            options={r.trial.options.map((o, i) => ({ value: i, label: o }))}
            value={choice}
            onChange={setChoice}
          />
          <Button
            label="Choose it and show the target"
            disabled={busy || choice === null}
            onPress={() => act(async () => (await chooseOption(db, r.id, choice!), await load()))}
          />
        </>
      )}

      {state === "judged" && (
        <Card>
          <SectionLabel>The target</SectionLabel>
          <Strong>{r.trial.options[r.trial.target]}</Strong>
          <Body>
            {r.trial.choice === r.trial.target
              ? "You chose this one."
              : `You chose ${r.trial.options[r.trial.choice!]}.`}
          </Body>
          <Muted>The other targets: {r.trial.options.filter((_, i) => i !== r.trial.target).join(", ")}.</Muted>
          <Button label="Start another trial" variant="quiet" onPress={() => router.replace("/blind/new")} />
        </Card>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button
        label="Delete this trial"
        variant="text"
        onPress={() =>
          Alert.alert("Delete this trial?", "It is taken out of your record. This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => (await deleteNote(db, r.id), router.back()) },
          ])
        }
      />
    </Screen>
  );
}
