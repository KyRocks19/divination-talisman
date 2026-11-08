// Makes src/core/card-prints.ts: the stored print of each of the 78 card pictures in assets/cards, for suggesting
// which card is in a photo (src/core/card-match.ts). Run again whenever a card picture or the print changes:
//   node --import tsx scripts/card-prints.ts
// tests/card-match.test.ts fails if the stored prints no longer match the pictures.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeCardPrints } from "./card-prints-make";

const root = join(import.meta.dirname, "..");
const prints = makeCardPrints((file) => readFileSync(join(root, "assets/cards", file)));
const lines = Object.entries(prints).map(([id, p]) => `  ${JSON.stringify(id)}: ${JSON.stringify(p)},`);
writeFileSync(
  join(root, "src/core/card-prints.ts"),
  `// Made by scripts/card-prints.ts from the pictures in assets/cards. Do not edit by hand.\n\nexport const CARD_PRINTS: Record<string, string> = {\n${lines.join("\n")}\n};\n`,
);
console.log(`Wrote ${lines.length} prints.`);
