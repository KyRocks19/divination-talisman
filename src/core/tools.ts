// The names of the tools a reading can come from, for lists and headings. A reading's `tool` column holds the id.

export const TOOL_NAMES: Record<string, string> = {
  tarot: "Tarot",
  oracle: "Oracle deck",
};

export function toolName(tool: string): string {
  return TOOL_NAMES[tool] ?? tool;
}
