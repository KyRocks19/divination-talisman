import { getRandomValues } from "expo-crypto";

/** A Math.random()-style function backed by the phone's secure random numbers. No network, ever. */
export function secureRandom(): number {
  const arr = new Uint32Array(1);
  getRandomValues(arr);
  return arr[0] / 2 ** 32;
}
