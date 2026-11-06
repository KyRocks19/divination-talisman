// Making or changing one oracle card: its name, its picture, the deck's fields, and the person's meanings with their
// history. Opened with ?deck=ID for a new card, or ?id=ID for an existing one.

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { cleanName } from "../../core/oracle";
import { createCard, deleteCard, getCard, getDeck, ORACLE_TOOL, updateCard, type Deck } from "../../db/oracle";
import { getMeanings, getSettings, type MeaningRow, type Orientation } from "../../db/queries";
import { deletePhoto, pickPhoto, type PhotoRef } from "../../lib/photos";
import { Body, Button, Card, ErrorNote, Field, Loading, Muted, Screen, SectionLabel } from "../../ui/kit";
import { OracleImage } from "../../ui/OracleImage";
import { OwnMeaning } from "../../ui/OwnMeaning";
import { space } from "../../ui/theme";
import { HERE } from "../../lib/where";

export default function OracleCardScreen() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string; deck?: string }>();
  const [cardId, setCardId] = useState<number | null>(params.id ? Number(params.id) : null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<PhotoRef | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<PhotoRef | null>(null);
  const [meanings, setMeanings] = useState<Partial<Record<Orientation, MeaningRow>>>({});
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Pictures copied into the app while this screen is open but never saved are deleted when it closes.
  const unsaved = useRef<PhotoRef[]>([]);
  useEffect(
    () => () => {
      for (const p of unsaved.current) deletePhoto(p);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      if (cardId !== null) {
        const c = await getCard(db, cardId);
        if (c) {
          setName(c.name);
          setValues(c.values);
          const ref = c.photo ? { photo: c.photo, linked: c.photoLinked } : null;
          setPhoto(ref);
          setSavedPhoto(ref);
          setDeck(await getDeck(db, c.deckId));
        }
      } else if (params.deck) {
        setDeck(await getDeck(db, Number(params.deck)));
      }
      setLoaded(true);
    })();
    // Load once: cardId changes only when this screen saves a new card, and then everything is already in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const loadMeanings = useCallback(async () => {
    if (cardId !== null) setMeanings(await getMeanings(db, ORACLE_TOOL, String(cardId)));
  }, [db, cardId]);
  useFocusEffect(
    useCallback(() => {
      loadMeanings();
    }, [loadMeanings]),
  );

  useEffect(() => {
    nav.setOptions({ title: cardId === null ? "New card" : name.trim() || "Card" });
  }, [cardId, name, nav]);

  if (!loaded) return <Loading />;
  if (!deck) {
    return (
      <Screen>
        <Body>This card or its deck is no longer {HERE}.</Body>
      </Screen>
    );
  }

  async function choose(source: "camera" | "library") {
    setError(null);
    setNote(null);
    const settings = await getSettings(db);
    const r = await pickPhoto(source, settings.photoMode);
    if (!r.ok) {
      if (r.error) setError(r.error);
      return;
    }
    if (!r.ref.linked) unsaved.current.push(r.ref);
    setPhoto(r.ref);
    setDirty(true);
    if (r.note) setNote(r.note);
  }

  async function save() {
    const c = cleanName(name);
    if (!c.ok) return setError(c.error);
    const input = { name: c.name, photo: photo?.photo ?? null, photoLinked: photo?.linked ?? false, values };
    if (cardId === null) {
      const newId = await createCard(db, deck!.id, deck!.fields, input);
      setCardId(newId);
      router.setParams({ id: String(newId), deck: undefined });
    } else {
      await updateCard(db, cardId, deck!.fields, input);
    }
    // The picture now belongs to the card; one it replaced is deleted if it was the app's own copy.
    unsaved.current = unsaved.current.filter((p) => p.photo !== photo?.photo);
    if (savedPhoto && savedPhoto.photo !== photo?.photo) deletePhoto(savedPhoto);
    setSavedPhoto(photo);
    setDirty(false);
    setNote("Saved.");
  }

  function remove() {
    Alert.alert("Delete this card?", "Its picture kept in the app and your meanings are deleted. Pulls it came up in keep its name. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCard(db, cardId!);
          deletePhoto(savedPhoto);
          router.back();
        },
      },
    ]);
  }

  const pictureWidth = Math.min(width * 0.5, 240);
  return (
    <Screen>
      <View style={{ alignItems: "center" }}>
        <OracleImage photo={photo} name={name.trim() || "New card"} width={pictureWidth} />
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button label="Take a photo" variant="quiet" style={{ flex: 1 }} onPress={() => choose("camera")} />
        <Button label="Choose a photo" variant="quiet" style={{ flex: 1 }} onPress={() => choose("library")} />
      </View>
      {photo && (
        <Button
          label="Take the picture off"
          variant="text"
          onPress={() => {
            setPhoto(null);
            setDirty(true);
          }}
        />
      )}
      {photo?.linked && <Muted>This picture is linked from your photo library. If you delete it there, the card loses its picture.</Muted>}

      <Field label="Name" value={name} onChangeText={(v) => (setName(v), setDirty(true), setError(null))} maxLength={120} />
      {deck.fields.map((f) => (
        <Field
          key={f.id}
          label={f.name}
          value={values[f.id] ?? ""}
          onChangeText={(v) => {
            setValues({ ...values, [f.id]: v });
            setDirty(true);
          }}
          multiline
        />
      ))}
      {deck.fields.length === 0 && (
        <Muted>To give every card in this deck the same headings, such as Element or Feeling, add fields under Change deck.</Muted>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {note && !error && <Body accessibilityLiveRegion="polite">{note}</Body>}
      <Button label={cardId === null ? "Save the card" : dirty ? "Save" : "Saved"} disabled={cardId !== null && !dirty} onPress={save} />

      {cardId !== null ? (
        <>
          <SectionLabel>Your meanings</SectionLabel>
          <OwnMeaning
            tool={ORACLE_TOOL}
            pieceId={String(cardId)}
            orientation="upright"
            label={deck.reversals ? "Your meaning, upright" : "Your meaning"}
            row={meanings.upright}
            onSaved={loadMeanings}
          />
          {deck.reversals && (
            <OwnMeaning tool={ORACLE_TOOL} pieceId={String(cardId)} orientation="reversed" row={meanings.reversed} onSaved={loadMeanings} />
          )}
          <Card>
            <Button label="Delete this card" variant="danger" onPress={remove} />
          </Card>
        </>
      ) : (
        <Muted>Once the card is saved, you can write your meanings for it.</Muted>
      )}
    </Screen>
  );
}
