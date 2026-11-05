// Drawing tarot cards for a spread. Pure: the random source is passed in, so the phone uses its secure random
// numbers (src/lib/random.ts) and the tests use a fixed sequence.

import { TAROT_DECK, type TarotCard } from "./cards";
import type { Spread } from "./spreads";

export type Rng = () => number;

export interface DrawnPiece {
  position: number;
  positionName: string;
  pieceId: string;
  reversed: boolean;
}

/** A Fisher-Yates shuffle of the whole deck, then one card per position. Each card can face either way when `reversals` is on. */
export function drawForSpread(spread: Spread, rng: Rng, reversals: boolean): DrawnPiece[] {
  const deck: TarotCard[] = [...TAROT_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return spread.positions.map((p, i) => ({
    position: i,
    positionName: p.name,
    pieceId: deck[i].id,
    reversed: reversals ? rng() < 0.5 : false,
  }));
}
