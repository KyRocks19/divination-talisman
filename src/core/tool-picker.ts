// The choices in the picker at the top of the Tools page: everything, or one tool on its own. Pure, so the list can be
// tested without a phone.

import { TOOLS } from "./tools";

/** "all", "tarot", "oracle", "practice", or the id of one of the other tools in `TOOLS`. */
export type ToolPick = string;

export const ALL_TOOLS: ToolPick = "all";

export function toolPickOptions(): { value: ToolPick; label: string }[] {
  return [
    { value: ALL_TOOLS, label: "All tools" },
    { value: "tarot", label: "Tarot" },
    { value: "oracle", label: "Your oracle decks" },
    ...TOOLS.map((tool) => ({ value: tool.id, label: tool.name })),
    { value: "practice", label: "Practice and notes" },
  ];
}

/** Whether the part of the page named `part` shows for the pick. An unknown pick (a tool since removed) shows everything. */
export function showsPart(pick: ToolPick, part: ToolPick): boolean {
  if (pick === ALL_TOOLS || !toolPickOptions().some((o) => o.value === pick)) return true;
  return pick === part;
}
