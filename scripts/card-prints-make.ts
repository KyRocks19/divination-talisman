// The print of every tarot card picture, shared by scripts/card-prints.ts and the test that checks the stored ones.

import jpeg from "jpeg-js";
import { TAROT_DECK } from "../src/core/cards";
import { packPrint, printOf } from "../src/core/card-match";

export function makeCardPrints(read: (fileName: string) => Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of TAROT_DECK) {
    const img = jpeg.decode(read(c.fileName), { useTArray: true });
    out[c.id] = packPrint(printOf({ width: img.width, height: img.height, data: img.data }));
  }
  return out;
}
