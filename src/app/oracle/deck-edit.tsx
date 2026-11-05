// Making or changing an oracle deck: its name, a description, whether cards can come up reversed, and the fields its
// cards have. Only the name is needed.

import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { addField, cleanName, renameField, type FieldDef } from "../../core/oracle";
import { createDeck, deleteDeck, getDeck, updateDeck } from "../../db/oracle";
import { deletePhoto } from "../../lib/photos";
import { Button, Card, Divider, ErrorNote, Field, Loading, Muted, Screen, SectionLabel, ToggleRow } from "../../ui/kit";
import { space } from "../../ui/theme";

export default function DeckEdit() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const deckId = id ? Number(id) : null;
  const [loaded, setLoaded] = useState(deckId === null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reversals, setReversals] = useState(false);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [newField, setNewField] = useState("");
  const [cardCount, setCardCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nav.setOptions({ title: deckId ? "Change deck" : "New deck" });
    if (deckId === null) return;
    getDeck(db, deckId).then((d) => {
      if (d) {
        setName(d.name);
        setDescription(d.description);
        setReversals(d.reversals);
        setFields(d.fields);
        setCardCount(d.cardCount);
      }
      setLoaded(true);
    });
  }, [db, deckId, nav]);

  if (!loaded) return <Loading />;

  async function save() {
    const c = cleanName(name);
    if (!c.ok) return setError(c.error);
    const input = { name: c.name, description, reversals, fields };
    if (deckId === null) {
      const newId = await createDeck(db, input);
      router.replace(`/oracle/${newId}`);
    } else {
      await updateDeck(db, deckId, input);
      router.back();
    }
  }

  function removeField(f: FieldDef) {
    Alert.alert(`Take "${f.name}" off this deck?`, "What you wrote in this field on every card is deleted. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Take it off", style: "destructive", onPress: () => setFields(fields.filter((x) => x.id !== f.id)) },
    ]);
  }

  function removeDeck() {
    Alert.alert(
      "Delete this deck?",
      `Its ${cardCount} ${cardCount === 1 ? "card" : "cards"}, their pictures kept in the app, and their meanings are deleted. Pulls you made with it stay in your record. Photos linked from your photo library are not touched. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const cards = await deleteDeck(db, deckId!);
            for (const c of cards) deletePhoto(c.photo ? { photo: c.photo, linked: c.photoLinked } : null);
            router.dismissTo("/tools");
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Field label="Name" value={name} onChangeText={(v) => (setName(v), setError(null))} maxLength={120} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline />
      <Card>
        <ToggleRow label="Reversed cards" help="Cards can come up upside down, with a meaning of their own." value={reversals} onChange={setReversals} />
      </Card>

      <SectionLabel>Fields on every card</SectionLabel>
      <Muted>Your own headings for what each card holds, such as Element, Feeling or Where I found it. Every field can stay empty.</Muted>
      <Card>
        {fields.length === 0 && <Muted>No fields yet. Each card already has a name, a picture and your meanings.</Muted>}
        {fields.map((f, i) => (
          <View key={f.id} style={{ gap: space.xs }}>
            {i > 0 && <Divider />}
            <Field
              label={`Field ${i + 1}`}
              value={f.name}
              onChangeText={(v) => setFields(fields.map((x) => (x.id === f.id ? { ...x, name: v } : x)))}
              onEndEditing={() => {
                const r = renameField(fields, f.id, f.name);
                if (!r.ok) setError(r.error);
                else setFields(r.defs);
              }}
              maxLength={120}
            />
            <Button label={`Take "${f.name || "this field"}" off`} variant="text" onPress={() => removeField(f)} />
          </View>
        ))}
        <Divider />
        <Field label="New field" value={newField} onChangeText={setNewField} placeholder="For example: Element" maxLength={120} />
        <Button
          label="Add the field"
          variant="quiet"
          disabled={!newField.trim()}
          onPress={() => {
            const r = addField(fields, newField);
            if (!r.ok) return setError(r.error);
            setFields(r.defs);
            setNewField("");
            setError(null);
          }}
        />
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      <Button label={deckId ? "Save" : "Make the deck"} onPress={save} />
      {deckId !== null && <Button label="Delete this deck" variant="danger" onPress={removeDeck} />}
    </Screen>
  );
}
