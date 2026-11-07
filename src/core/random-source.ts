// Where the chance in a reading comes from. The person chooses in Settings: random.org (the default), which makes
// its numbers from atmospheric noise, or this phone's own secure random numbers. Pure: the network request and the
// phone's numbers are passed in, so the tests can stand in for both.
//
// random.org is asked only for a list of plain numbers. Nothing about the person or the reading is sent. When
// random.org cannot be reached (no signal, airplane mode, its daily limit, a slow answer), the phone's own numbers
// are used instead and the reading says so; it is never silent.

import type { Rng } from "./draw";

/** What the person chose in Settings. */
export type RandomSetting = "random.org" | "device";
/** What a reading was actually made with. "device-fallback": random.org was chosen but could not be used. */
export type RandomUsed = "random.org" | "device" | "device-fallback";

export const DEFAULT_RANDOM_SETTING: RandomSetting = "random.org";
export const RANDOM_SETTINGS: RandomSetting[] = ["random.org", "device"];

/** The choice's name in Settings. `deviceWord` is "this phone" or "this browser". */
export function randomSettingLabel(setting: RandomSetting, deviceWord = "this phone"): string {
  return setting === "random.org" ? "random.org" : `${deviceWord[0].toUpperCase()}${deviceWord.slice(1)} only`;
}

/** What the choice does, in plain words. */
export function randomSettingHelp(setting: RandomSetting, deviceWord = "this phone"): string {
  if (setting === "random.org") {
    return `Each reading asks random.org for a list of numbers made from atmospheric noise. Only the request for numbers is sent: not your question, your words or your readings. random.org sees the internet address of your connection. If it cannot be reached, ${deviceWord}'s own random numbers are used and the reading says so.`;
  }
  return `${deviceWord[0].toUpperCase()}${deviceWord.slice(1)}'s own secure random numbers. Nothing is sent anywhere, and it works with no connection.`;
}

/** Takes a saved setting value and gives a known one; anything else is the default. */
export function cleanRandomSetting(value: string | null | undefined): RandomSetting {
  return value === "device" ? "device" : value === "random.org" ? "random.org" : DEFAULT_RANDOM_SETTING;
}

/** Takes a saved reading value and gives a known one, or null for readings made before this was kept. */
export function cleanRandomUsed(value: string | null | undefined): RandomUsed | null {
  return value === "random.org" || value === "device" || value === "device-fallback" ? value : null;
}

/** Plain words for a reading: where its chance came from. */
export function randomUsedWords(used: RandomUsed, deviceWord = "this phone"): string {
  if (used === "random.org") return "Chance from random.org";
  if (used === "device") return `Chance from ${deviceWord}'s own random numbers`;
  return `Chance from ${deviceWord}'s own random numbers, because random.org could not be used`;
}

/** random.org's integers can go up to 1,000,000,000; 0 to 999,999,999 divides evenly into a number from 0 up to 1. */
const RANDOM_ORG_SPAN = 1_000_000_000;
/** The most integers random.org gives in one request. */
export const RANDOM_ORG_MAX_COUNT = 10_000;

/** The random.org address for `count` whole numbers from 0 to 999,999,999, one to a line, freshly made. */
export function randomOrgUrl(count: number): string {
  const n = Math.max(1, Math.min(RANDOM_ORG_MAX_COUNT, Math.floor(count)));
  return `https://www.random.org/integers/?num=${n}&min=0&max=${RANDOM_ORG_SPAN - 1}&col=1&base=10&format=plain&rnd=new`;
}

/** Turns random.org's plain answer into numbers from 0 up to (not including) 1, or null if it is not what was asked for. */
export function parseRandomOrg(text: string, count: number): number[] | null {
  const lines = text.trim().split(/\s+/);
  if (lines.length !== count) return null;
  const out: number[] = [];
  for (const line of lines) {
    if (!/^\d{1,9}$/.test(line)) return null;
    out.push(Number(line) / RANDOM_ORG_SPAN);
  }
  return out;
}

/** How many random numbers one run of `run` asks for, with `rng` giving the numbers. */
export function countCalls(run: (rng: Rng) => unknown, rng: Rng): number {
  let n = 0;
  run(() => (n++, rng()));
  return n;
}

/**
 * How many numbers to ask random.org for. Most draws ask for the same count every time (a shuffle of a fixed length, a
 * fixed count of coin tosses), but some vary a little: a rune is only turned over if it can be reversed. So the count
 * is the most of three dry runs, with some to spare. Numbers not used are thrown away.
 */
export function numbersToAsk(run: (rng: Rng) => unknown, rng: Rng): number {
  const most = Math.max(countCalls(run, rng), countCalls(run, () => 0), countCalls(run, () => 0.999999999));
  return most === 0 ? 0 : most + Math.ceil(most / 4) + 8;
}

/** An `Rng` that hands out `values` in order, then `fallback`'s numbers if they run out. */
export function poolRng(values: number[], fallback: Rng): { rng: Rng; ranShort: () => boolean } {
  let i = 0;
  let short = false;
  return {
    rng: () => {
      if (i < values.length) return values[i++];
      short = true;
      return fallback();
    },
    ranShort: () => short,
  };
}

export interface RandomDeps {
  /** Fetches a web address and gives its text; throws on any failure. */
  fetchText: (url: string) => Promise<string>;
  /** The phone's own secure random numbers. */
  device: Rng;
}

export interface Drawn<T> {
  result: T;
  used: RandomUsed;
  /** Why random.org was not used, in plain words, when it was chosen and could not be. */
  problem: string | null;
}

/**
 * Makes `run`'s result with the chosen source of chance. `run` must be pure (with random.org it is first run dry to
 * count the numbers it needs, then for real). With random.org, its numbers are fetched first; when that fails, the
 * phone's numbers are used and `used` is "device-fallback" with the reason in `problem`.
 */
export async function drawWith<T>(setting: RandomSetting, run: (rng: Rng) => T, deps: RandomDeps): Promise<Drawn<T>> {
  if (setting === "device") return { result: run(deps.device), used: "device", problem: null };
  const count = numbersToAsk(run, deps.device);
  if (count === 0) return { result: run(deps.device), used: "device", problem: null };
  if (count > RANDOM_ORG_MAX_COUNT) {
    return { result: run(deps.device), used: "device-fallback", problem: "This needs more numbers than random.org gives at once." };
  }
  let values: number[] | null;
  try {
    values = parseRandomOrg(await deps.fetchText(randomOrgUrl(count)), count);
  } catch (e) {
    return { result: run(deps.device), used: "device-fallback", problem: describeProblem(e) };
  }
  if (!values) return { result: run(deps.device), used: "device-fallback", problem: "random.org sent back something other than the numbers asked for." };
  const pool = poolRng(values, deps.device);
  const result = run(pool.rng);
  if (pool.ranShort()) return { result, used: "device-fallback", problem: "random.org's numbers ran out partway, so the rest came from this device." };
  return { result, used: "random.org", problem: null };
}

/** A failed request in plain words. */
export function describeProblem(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/abort|timed? ?out/i.test(m)) return "random.org did not answer in time.";
  if (/quota|503/i.test(m)) return "random.org's daily limit for this connection has been reached.";
  if (/network|failed to fetch|offline|internet/i.test(m)) return "There is no internet connection, or random.org could not be reached.";
  return `random.org could not be reached (${m}).`;
}
