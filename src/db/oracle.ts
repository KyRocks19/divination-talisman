// The person's own oracle decks and cards. Meanings use the shared `meanings` table with tool "oracle" and the card's
// id as the piece id, so they get the same history as tarot meanings (queries.ts).

import type { Db } from "./types";
import { cleanFieldValues, parseFieldDefs, parseFieldValues, type FieldDef } from "../core/oracle";

const now = () => new Date().toISOString();

export const ORACLE_TOOL = "oracle";

export interface DeckRow {
  id: number;
  name: string;
  description: string;
  reversals: number;
  field_defs: string;
  created_at: string;
}

export interface Deck {
  id: number;
  name: string;
  description: string;
  reversals: boolean;
  fields: FieldDef[];
  createdAt: string;
  cardCount: number;
}

export interface CardRow {
  id: number;
  deck_id: number;
  name: string;
  photo_uri: string | null;
  photo_linked: number;
  fields: string;
  created_at: string;
  updated_at: string | null;
}

export interface OracleCard {
  id: number;
  deckId: number;
  name: string;
  /** A path inside the app's storage, or a photo library id when `photoLinked`. */
  photo: string | null;
  photoLinked: boolean;
  values: Record<string, string>;
  createdAt: string;
}

const toDeck = (r: DeckRow & { card_count?: number }): Deck => ({
  id: r.id,
  name: r.name,
  description: r.description,
  reversals: !!r.reversals,
  fields: parseFieldDefs(r.field_defs),
  createdAt: r.created_at,
  cardCount: r.card_count ?? 0,
});

const toCard = (r: CardRow): OracleCard => ({
  id: r.id,
  deckId: r.deck_id,
  name: r.name,
  photo: r.photo_uri,
  photoLinked: !!r.photo_linked,
  values: parseFieldValues(r.fields),
  createdAt: r.created_at,
});

export async function listDecks(db: Db): Promise<Deck[]> {
  const rows = await db.getAllAsync<DeckRow & { card_count: number }>(
    "SELECT d.*, (SELECT count(*) FROM oracle_cards c WHERE c.deck_id = d.id) AS card_count FROM oracle_decks d ORDER BY d.name COLLATE NOCASE, d.id",
    [],
  );
  return rows.map(toDeck);
}

export async function getDeck(db: Db, id: number): Promise<Deck | null> {
  const r = await db.getFirstAsync<DeckRow & { card_count: number }>(
    "SELECT d.*, (SELECT count(*) FROM oracle_cards c WHERE c.deck_id = d.id) AS card_count FROM oracle_decks d WHERE d.id = ?",
    [id],
  );
  return r ? toDeck(r) : null;
}

export interface DeckInput {
  name: string;
  description: string;
  reversals: boolean;
  fields: FieldDef[];
}

export async function createDeck(db: Db, d: DeckInput): Promise<number> {
  const res = await db.runAsync("INSERT INTO oracle_decks (name, description, reversals, field_defs, created_at) VALUES (?, ?, ?, ?, ?)", [
    d.name,
    d.description.trim(),
    d.reversals ? 1 : 0,
    JSON.stringify(d.fields),
    now(),
  ]);
  return res.lastInsertRowId;
}

/** Saves the deck. A field taken off the deck also takes its value off every card, since nothing could show it again. */
export async function updateDeck(db: Db, id: number, d: DeckInput): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE oracle_decks SET name = ?, description = ?, reversals = ?, field_defs = ? WHERE id = ?", [
      d.name,
      d.description.trim(),
      d.reversals ? 1 : 0,
      JSON.stringify(d.fields),
      id,
    ]);
    const cards = await db.getAllAsync<CardRow>("SELECT * FROM oracle_cards WHERE deck_id = ?", [id]);
    for (const c of cards) {
      const before = c.fields;
      const after = JSON.stringify(cleanFieldValues(d.fields, parseFieldValues(c.fields)));
      if (after !== before) await db.runAsync("UPDATE oracle_cards SET fields = ? WHERE id = ?", [after, c.id]);
    }
  });
}

/**
 * Deletes a deck, its cards and their meanings. Pulls made with it stay in the record under the names the cards had.
 * Returns the cards' photos, so the caller can delete the app's own copies.
 */
export async function deleteDeck(db: Db, id: number): Promise<OracleCard[]> {
  const cards = await listCards(db, id);
  await db.withTransactionAsync(async () => {
    for (const c of cards) await db.runAsync("DELETE FROM meanings WHERE tool = ? AND piece_id = ?", [ORACLE_TOOL, String(c.id)]);
    await db.runAsync("DELETE FROM oracle_decks WHERE id = ?", [id]);
  });
  return cards;
}

export async function listCards(db: Db, deckId: number): Promise<OracleCard[]> {
  const rows = await db.getAllAsync<CardRow>("SELECT * FROM oracle_cards WHERE deck_id = ? ORDER BY name COLLATE NOCASE, id", [deckId]);
  return rows.map(toCard);
}

export async function getCard(db: Db, id: number): Promise<OracleCard | null> {
  const r = await db.getFirstAsync<CardRow>("SELECT * FROM oracle_cards WHERE id = ?", [id]);
  return r ? toCard(r) : null;
}

/** Several cards by id, for showing the pieces of a pull. Ids of deleted cards are simply missing from the map. */
export async function cardsById(db: Db, ids: number[]): Promise<Map<number, OracleCard>> {
  if (ids.length === 0) return new Map();
  const rows = await db.getAllAsync<CardRow>(`SELECT * FROM oracle_cards WHERE id IN (${ids.map(() => "?").join(", ")})`, ids);
  return new Map(rows.map((r) => [r.id, toCard(r)]));
}

export interface CardInput {
  name: string;
  photo: string | null;
  photoLinked: boolean;
  values: Record<string, string>;
}

export async function createCard(db: Db, deckId: number, fields: FieldDef[], c: CardInput): Promise<number> {
  const t = now();
  const res = await db.runAsync(
    "INSERT INTO oracle_cards (deck_id, name, photo_uri, photo_linked, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [deckId, c.name, c.photo, c.photoLinked ? 1 : 0, JSON.stringify(cleanFieldValues(fields, c.values)), t, t],
  );
  return res.lastInsertRowId;
}

/** Adds many cards in one go (a batch of photos), in order. Returns their ids. */
export async function createCards(db: Db, deckId: number, fields: FieldDef[], cards: CardInput[]): Promise<number[]> {
  const ids: number[] = [];
  await db.withTransactionAsync(async () => {
    for (const c of cards) ids.push(await createCard(db, deckId, fields, c));
  });
  return ids;
}

export async function updateCard(db: Db, id: number, fields: FieldDef[], c: CardInput): Promise<void> {
  await db.runAsync("UPDATE oracle_cards SET name = ?, photo_uri = ?, photo_linked = ?, fields = ?, updated_at = ? WHERE id = ?", [
    c.name,
    c.photo,
    c.photoLinked ? 1 : 0,
    JSON.stringify(cleanFieldValues(fields, c.values)),
    now(),
    id,
  ]);
}

/** Deletes a card and its meanings. Pulls keep the name it had. */
export async function deleteCard(db: Db, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM meanings WHERE tool = ? AND piece_id = ?", [ORACLE_TOOL, String(id)]);
    await db.runAsync("DELETE FROM oracle_cards WHERE id = ?", [id]);
  });
}

/** Every card photo, for the backup: copies by their path, links by their library id. */
export async function allCardPhotos(db: Db): Promise<{ id: number; photo: string; linked: boolean }[]> {
  const rows = await db.getAllAsync<{ id: number; photo_uri: string; photo_linked: number }>(
    "SELECT id, photo_uri, photo_linked FROM oracle_cards WHERE photo_uri IS NOT NULL AND photo_uri <> ''",
    [],
  );
  return rows.map((r) => ({ id: r.id, photo: r.photo_uri, linked: !!r.photo_linked }));
}
