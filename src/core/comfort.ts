// Reading comfort: the type, spacing, motion and colour choices a person makes for themselves, as in the desktop app's
// Settings, "Look and comfort" (lib/comfort.ts there). Plain data and plain functions, so it can be tested on Node.
// The phone's own text size still applies; the size chosen here is on top of it.

export type ComfortFont = "system" | "atkinson" | "lexend" | "opendyslexic";
export type ComfortSize = 100 | 115 | 130 | 150;
export type ComfortSpacing = "normal" | "roomy";
export type ComfortMotion = "system" | "less";
/** "phone" follows the phone's dark or light setting; "dark" and "light" are the app's own two looks; anything else is
 *  the id of one of the desktop's ready-made themes (src/ui/themes-data.ts). */
export type ComfortColours = string;

export interface Comfort {
  font: ComfortFont;
  size: ComfortSize;
  spacing: ComfortSpacing;
  motion: ComfortMotion;
  colours: ComfortColours;
  /** Swipe left or right on a tab's page to go to the next or previous tab. The tab bar always works too. */
  swipeTabs: boolean;
}

export const DEFAULT_COMFORT: Comfort = { font: "system", size: 100, spacing: "normal", motion: "system", colours: "phone", swipeTabs: true };

export const FONT_CHOICES: { id: ComfortFont; label: string; note: string }[] = [
  { id: "system", label: "My phone's own font", note: "The font you already read everything else on your phone in." },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    note: "Made by the Braille Institute so that letters that look alike (I, l, 1, O, 0) are easy to tell apart. Made for low vision.",
  },
  { id: "lexend", label: "Lexend", note: "Wider, evenly spaced letters, designed to make reading feel easier. Many people with dyslexia or ADHD like it." },
  {
    id: "opendyslexic",
    label: "OpenDyslexic",
    note: "Letters with heavier bottoms, made for people with dyslexia. Research on whether it helps is mixed; it helps some people a lot, so it is here to try.",
  },
];

export const SIZE_CHOICES: { id: ComfortSize; label: string }[] = [
  { id: 100, label: "Standard" },
  { id: 115, label: "Larger" },
  { id: 130, label: "Large" },
  { id: 150, label: "Largest" },
];

const FONTS: ComfortFont[] = ["system", "atkinson", "lexend", "opendyslexic"];
const SIZES: ComfortSize[] = [100, 115, 130, 150];

/** Reads what was stored, tolerating nothing, garbage or a half-written value: anything unknown falls back to the default.
 *  `colourIds` are the themes this version knows, so a theme that is gone falls back too. */
export function parseComfort(raw: string | null | undefined, colourIds: readonly string[] = []): Comfort {
  let d: Record<string, unknown> = {};
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (data && typeof data === "object" && !Array.isArray(data)) d = data as Record<string, unknown>;
  } catch {
    // the default
  }
  const colours = typeof d.colours === "string" && ["phone", "dark", "light", ...colourIds].includes(d.colours) ? d.colours : DEFAULT_COMFORT.colours;
  return {
    font: FONTS.includes(d.font as ComfortFont) ? (d.font as ComfortFont) : DEFAULT_COMFORT.font,
    size: SIZES.includes(d.size as ComfortSize) ? (d.size as ComfortSize) : DEFAULT_COMFORT.size,
    spacing: d.spacing === "roomy" ? "roomy" : "normal",
    motion: d.motion === "less" ? "less" : "system",
    colours,
    swipeTabs: d.swipeTabs === false ? false : true,
  };
}

export type Weight = "regular" | "bold";

/** The name each font was loaded under (src/ui/comfort.tsx), by weight. The phone's own font has none. */
export const FONT_FAMILIES: Record<Exclude<ComfortFont, "system">, Record<Weight, string>> = {
  atkinson: { regular: "AtkinsonHyperlegible_400Regular", bold: "AtkinsonHyperlegible_700Bold" },
  lexend: { regular: "Lexend_400Regular", bold: "Lexend_700Bold" },
  opendyslexic: { regular: "OpenDyslexic-Regular", bold: "OpenDyslexic-Bold" },
};

/** A kind of text: its size at the standard setting, its line height if it has one, and whether it is bold ("semi" is a
 *  little less bold, where the phone's own font can show it). */
export interface TextBase {
  fontSize: number;
  lineHeight?: number;
  bold?: boolean | "semi";
  letterSpacing?: number;
}

export interface TextLook {
  fontSize: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: "400" | "600" | "700";
  letterSpacing?: number;
}

/**
 * The text style for one kind of text: the size chosen here, roomier lines and letters when asked for, and the chosen
 * font. A loaded font is named by weight, and the weight itself is left out, because Android draws a made-up bold over a
 * named font that is already bold.
 */
export function textLook(c: Comfort, base: TextBase, fontsReady = true): TextLook {
  const scale = c.size / 100;
  const roomy = c.spacing === "roomy";
  const fontSize = Math.round(base.fontSize * scale * 10) / 10;
  const look: TextLook = { fontSize };
  const lineHeight = base.lineHeight ?? (roomy ? base.fontSize * 1.35 : undefined);
  if (lineHeight !== undefined) look.lineHeight = Math.round(lineHeight * scale * (roomy ? 1.25 : 1));
  const spacing = (base.letterSpacing ?? 0) + (roomy ? 0.4 : 0);
  if (spacing) look.letterSpacing = spacing;
  if (c.font !== "system" && fontsReady) {
    look.fontFamily = FONT_FAMILIES[c.font][base.bold ? "bold" : "regular"];
  } else if (base.bold) {
    look.fontWeight = base.bold === "semi" ? "600" : "700";
  }
  return look;
}

/** The space between parts of a page: a little more when roomy spacing is chosen. */
export function gapFor(c: Comfort, gap: number): number {
  return c.spacing === "roomy" ? Math.round(gap * 1.5) : gap;
}

/** Whether screens should leave out movement: the phone's own "reduce motion" setting, or the choice here. */
export function lessMotion(c: Comfort, phoneSaysReduce: boolean): boolean {
  return c.motion === "less" || phoneSaysReduce;
}

// ── Swiping between tabs ─────────────────────────────────────────────────────────────────────────────

export const TAB_ORDER = ["index", "tools", "record", "me"] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** A swipe that starts this close to the side of the screen is left to the phone (Android's back gesture). */
export const SWIPE_EDGE = 28;

/** Whether a finger's movement so far is a sideways swipe (and not a scroll, a tap or a slip). */
export function isSideways(dx: number, dy: number): boolean {
  return Math.abs(dx) >= 24 && Math.abs(dx) > Math.abs(dy) * 2;
}

/** The tab a finished swipe goes to, or null when it was too short or too slanted. Swiping left goes to the next tab. */
export function swipeTarget(from: TabName, dx: number, dy: number, vx = 0): TabName | null {
  const far = Math.abs(dx) >= 80 || (Math.abs(dx) >= 40 && Math.abs(vx) >= 0.5);
  if (!far || Math.abs(dx) <= Math.abs(dy) * 2) return null;
  const i = TAB_ORDER.indexOf(from) + (dx < 0 ? 1 : -1);
  return i >= 0 && i < TAB_ORDER.length ? TAB_ORDER[i] : null;
}
