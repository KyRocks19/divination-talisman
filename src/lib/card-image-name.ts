import { getCardById } from "../core/cards";

/** The picture file for a card id, or null for an id the deck does not have. Pure, so the tests can check it. */
export function cardImageFor(cardId: string): string | null {
  return getCardById(cardId)?.fileName ?? null;
}
