import { getRandomValues } from "expo-crypto";
import { drawWith, type Drawn, type RandomSetting } from "../core/random-source";
import type { Rng } from "../core/draw";

/** A Math.random()-style function backed by the phone's secure random numbers. No network. */
export function secureRandom(): number {
  const arr = new Uint32Array(1);
  getRandomValues(arr);
  return arr[0] / 2 ** 32;
}

/** How long to wait for random.org before using the phone's own numbers. */
const RANDOM_ORG_WAIT_MS = 6000;

/**
 * Asks random.org for its plain-text numbers. No cookies, no stored copy, nothing about the person in the request.
 * Throws on any failure, so the caller falls back to the phone's numbers and says so.
 */
async function fetchRandomOrg(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RANDOM_ORG_WAIT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store", credentials: "omit" });
    const text = await res.text();
    if (!res.ok) throw new Error(/quota/i.test(text) ? "quota" : `random.org answered ${res.status}`);
    return text;
  } catch (e) {
    if (controller.signal.aborted) throw new Error("timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Runs a draw with the source of chance the person chose (src/core/random-source.ts). */
export function drawWithSetting<T>(setting: RandomSetting, run: (rng: Rng) => T): Promise<Drawn<T>> {
  return drawWith(setting, run, { fetchText: fetchRandomOrg, device: secureRandom });
}
