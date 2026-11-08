// Adding a whole oracle deck from photos: choose many from the library at once, or take them one after another with
// the camera. Each photo becomes a card named "Card 1", "Card 2" and so on, saved straight away so nothing is lost;
// the person names each card and writes its meaning afterwards. Opened with ?deck=ID.

import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { numberedNames } from "../../core/oracle";
import { createCards, getDeck, listCards, type Deck, type OracleCard } from "../../db/oracle";
import { getSettings } from "../../db/queries";
import { deletePhoto, pickPhoto, pickPhotos, type PhotoRef } from "../../lib/photos";
import { Body, Button, ErrorNote, Loading, Muted, Screen, SectionLabel } from "../../ui/kit";
import { OracleImage } from "../../ui/OracleImage";
import { space, useTokens } from "../../ui/theme";
import { useType } from "../../ui/comfort";
import { HERE } from "../../lib/where";

const COLUMNS = 3;

export default function AddManyScreen() {
  const db = useSQLiteContext();
  const t = useTokens();
  const type = useType();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ deck: string }>();
  const deckId = Number(params.deck);
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [names, setNames] = useState<string[]>([]);
  const [added, setAdded] = useState<OracleCard[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setDeck(await getDeck(db, deckId));
      setNames((await listCards(db, deckId)).map((c) => c.name));
    })();
  }, [db, deckId]);

  if (deck === undefined) return <Loading />;
  if (deck === null) {
    return (
      <Screen>
        <Body>This deck is no longer {HERE}.</Body>
      </Screen>
    );
  }

  /** Saves the pictures as new cards, in order, and adds them to the list on this screen. */
  async function save(refs: PhotoRef[]): Promise<OracleCard[]> {
    const newNames = numberedNames(names, refs.length);
    try {
      const ids = await createCards(
        db,
        deck!.id,
        deck!.fields,
        refs.map((r, i) => ({ name: newNames[i], photo: r.photo, photoLinked: r.linked, values: {} })),
      );
      const all = await listCards(db, deck!.id);
      const fresh = all.filter((c) => ids.includes(c.id));
      setNames(all.map((c) => c.name));
      setAdded((prev) => [...prev, ...fresh]);
      return fresh;
    } catch {
      for (const r of refs) deletePhoto(r);
      setError("The cards could not be saved. Nothing was added.");
      return [];
    }
  }

  async function fromLibrary() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const settings = await getSettings(db);
      const r = await pickPhotos(settings.photoMode);
      if (!r.ok) {
        if (r.error) setError(r.error);
        return;
      }
      const n = (await save(r.refs)).length;
      if (n === 0) return;
      const parts = [`${n} ${n === 1 ? "card" : "cards"} added.`];
      if (r.copied > 0) parts.push(`${r.copied} ${r.copied === 1 ? "photo" : "photos"} could not be linked, so a copy was kept in the app instead.`);
      setNote(parts.join(" "));
    } finally {
      setBusy(false);
    }
  }

  async function fromCamera() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const settings = await getSettings(db);
      const r = await pickPhoto("camera", settings.photoMode);
      if (!r.ok) {
        if (r.error) setError(r.error);
        return;
      }
      const [card] = await save([r.ref]);
      if (!card) return;
      setNote([`${card.name} added.`, r.note].filter(Boolean).join(" "));
    } finally {
      setBusy(false);
    }
  }

  const cardWidth = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;
  const tookOne = added.length > 0;
  return (
    <Screen>
      <Body>
        Each photo becomes a card called Card 1, Card 2 and so on, saved straight away. Tap a card afterwards to give it
        its name and write what it means to you.
      </Body>
      <Muted>Tip: lay each card on a plain surface in good light and fill the photo with it.</Muted>
      <Button label="Choose photos from your library" disabled={busy} onPress={fromLibrary} />
      <Button
        label={tookOne ? "Take a photo of the next card" : "Take photos, one card at a time"}
        variant="quiet"
        disabled={busy}
        onPress={fromCamera}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {note && <Body>{note}</Body>}
      {tookOne && (
        <>
          <SectionLabel>Added just now ({added.length})</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {added.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/oracle/card", params: { id: String(c.id) } })}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, change this card`}
                style={({ pressed }) => ({ width: cardWidth, gap: space.xs, opacity: pressed ? 0.8 : 1 })}
              >
                <OracleImage photo={c.photo ? { photo: c.photo, linked: c.photoLinked } : null} name={c.name} width={cardWidth} />
                <Text style={{ color: t.ink, ...type({ fontSize: 13 }), textAlign: "center" }} numberOfLines={2}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button label="Done" variant="quiet" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}
