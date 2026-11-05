// The person's own oracle decks: the fields a deck asks for, and checking names. Pure, so it is tested without a phone.
// Nothing here is required beyond a card's name (design rule 10: no required fields beyond a name).

export interface FieldDef {
  /** Stable id, so renaming a field keeps every card's value. */
  id: string;
  name: string;
}

export const MAX_NAME = 120;
export const MAX_FIELDS = 20;
export const MAX_FIELD_VALUE = 4000;

export function parseFieldDefs(json: string | null | undefined): FieldDef[] {
  try {
    const v = JSON.parse(json || "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((f): f is FieldDef => f && typeof f.id === "string" && typeof f.name === "string");
  } catch {
    return [];
  }
}

export function parseFieldValues(json: string | null | undefined): Record<string, string> {
  try {
    const v = JSON.parse(json || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
    return out;
  } catch {
    return {};
  }
}

/** A trimmed name, or an error in plain words. */
export function cleanName(value: string, what = "name"): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: `Give it a ${what}.` };
  if (name.length > MAX_NAME) return { ok: false, error: `That ${what} is too long (${MAX_NAME} characters at most).` };
  return { ok: true, name };
}

/** Adds a field with a new id that no field of this deck has had. */
export function addField(defs: FieldDef[], name: string): { ok: true; defs: FieldDef[] } | { ok: false; error: string } {
  const c = cleanName(name, "field name");
  if (!c.ok) return c;
  if (defs.length >= MAX_FIELDS) return { ok: false, error: `A deck can have ${MAX_FIELDS} fields at most.` };
  if (defs.some((d) => d.name.toLowerCase() === c.name.toLowerCase())) return { ok: false, error: "This deck already has a field with that name." };
  const used = new Set(defs.map((d) => d.id));
  let n = defs.length + 1;
  while (used.has(`f${n}`)) n++;
  return { ok: true, defs: [...defs, { id: `f${n}`, name: c.name }] };
}

export function renameField(defs: FieldDef[], id: string, name: string): { ok: true; defs: FieldDef[] } | { ok: false; error: string } {
  const c = cleanName(name, "field name");
  if (!c.ok) return c;
  if (defs.some((d) => d.id !== id && d.name.toLowerCase() === c.name.toLowerCase())) return { ok: false, error: "This deck already has a field with that name." };
  return { ok: true, defs: defs.map((d) => (d.id === id ? { ...d, name: c.name } : d)) };
}

/** Only the values of fields the deck still has, trimmed, with empty ones left out. */
export function cleanFieldValues(defs: FieldDef[], values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) {
    const v = (values[d.id] ?? "").trim().slice(0, MAX_FIELD_VALUE);
    if (v) out[d.id] = v;
  }
  return out;
}
