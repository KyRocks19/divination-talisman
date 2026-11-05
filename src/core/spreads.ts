// The built-in tarot spreads. They ship inside the app (they are never stored), so they need no migrating.
// The names, descriptions and colours are the desktop app's starting spreads (lib/starter-layouts.ts there).

export interface SpreadPosition {
  name: string;
  description: string;
  color: string;
}

export interface Spread {
  /** Stable id, saved on each reading so a reading still names its spread if the wording here changes. */
  id: string;
  name: string;
  description: string;
  positions: SpreadPosition[];
}

export const BUILT_IN_SPREADS: Spread[] = [
  {
    id: "single",
    name: "Single Card",
    description: "One card for the day or a simple question.",
    positions: [{ name: "Card", description: "Your card for the day or question", color: "#a855f7" }],
  },
  {
    id: "past-present-future",
    name: "Past | Present | Future",
    description: "A classic three-card spread showing how things have moved.",
    positions: [
      { name: "Past", description: "What has led to the current situation", color: "#38bdf8" },
      { name: "Present", description: "The current state of affairs", color: "#f59e0b" },
      { name: "Future", description: "Where things are heading", color: "#10b981" },
    ],
  },
  {
    id: "situation-challenge-advice-outcome",
    name: "Situation | Challenge | Advice | Outcome",
    description: "A four-card spread for practical guidance.",
    positions: [
      { name: "Situation", description: "The current situation or context", color: "#a855f7" },
      { name: "Challenge", description: "The main obstacle or difficulty", color: "#f43f5e" },
      { name: "Advice", description: "Guidance on how to proceed", color: "#10b981" },
      { name: "Outcome", description: "The likely outcome if the advice is followed", color: "#f59e0b" },
    ],
  },
  {
    id: "celtic-cross",
    name: "Celtic Cross",
    description: "The classic ten-card spread for in-depth readings.",
    positions: [
      { name: "Heart of the Matter", description: "The central energy or core of the situation", color: "#a855f7" },
      { name: "Crossing It", description: "What crosses or challenges the heart of the matter", color: "#f59e0b" },
      { name: "Root of the Issue", description: "The underlying foundation or origin of the situation", color: "#94a3b8" },
      { name: "Past Influence", description: "Recent events or energies that are passing away", color: "#38bdf8" },
      { name: "Present Influence", description: "Conscious goals or the best possible outcome", color: "#fbbf24" },
      { name: "Future Opportunity", description: "What is coming into being in the near future", color: "#10b981" },
      { name: "Self", description: "Your own attitude, inner state, or how you see yourself", color: "#6366f1" },
      { name: "Environment", description: "Outside influences: how others see you or what surrounds you", color: "#14b8a6" },
      { name: "Guidance", description: "Your hopes, fears, or the deeper wisdom available to you", color: "#e879f9" },
      { name: "Outcome", description: "The final outcome if the current path continues", color: "#fb923c" },
    ],
  },
];

export function getSpread(id: string): Spread | undefined {
  return BUILT_IN_SPREADS.find((s) => s.id === id);
}
