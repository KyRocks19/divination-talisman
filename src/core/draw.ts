// Drawing pieces for a spread. Pure: the random source is passed in, so the phone uses its secure random numbers
// (src/lib/random.ts) and the tests use a fixed sequence.

import { TAROT_DECK } from "./cards";
import type { Spread } from "./spreads";

export type Rng = () => number;

export interface DrawnPiece {
  position: number;
  positionName: string;
  pieceId: string;
  /** What the piece is called at the moment of drawing, kept with the reading. */
  pieceName: string;
  reversed: boolean;
}

/**
 * A Fisher-Yates shuffle of the pieces, then one per position. Each can face either way when `reversals` is on.
 * Throws when there are fewer pieces than positions.
 */
export function drawPieces(pieces: { id: string; name: string }[], spread: Spread, rng: Rng, reversals: boolean): DrawnPiece[] {
  if (pieces.length < spread.positions.length) {
    throw new Error(`This spread needs ${spread.positions.length} cards and the deck has ${pieces.length}.`);
  }
  const deck = [...pieces];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return spread.positions.map((p, i) => ({
    position: i,
    positionName: p.name,
    pieceId: deck[i].id,
    pieceName: deck[i].name,
    reversed: reversals ? rng() < 0.5 : false,
  }));
}

/** A tarot draw from the 78 cards. */
export function drawForSpread(spread: Spread, rng: Rng, reversals: boolean): DrawnPiece[] {
  return drawPieces(TAROT_DECK, spread, rng, reversals);
}
