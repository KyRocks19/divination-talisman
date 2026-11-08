// A photo of one real tarot card, turned into suggestions of which card it is. Everything happens on the phone: the
// photo is made small, read as pixels and compared with the stored prints of the 78 cards (src/core/card-match.ts).
// The photo itself is not kept anywhere.

import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { fromBase64, suggestCards, unpackPrint, type Suggestion } from "../core/card-match";
import { CARD_PRINTS } from "../core/card-prints";

let prints: { cardId: string; print: Float32Array }[] | null = null;
function storedPrints() {
  prints ??= Object.entries(CARD_PRINTS).map(([cardId, p]) => ({ cardId, print: unpackPrint(p) }));
  return prints;
}

/** The longer side of the small copy the suggestions are made from. Plenty for a grid of 8 by 14. */
const SMALL = 320;

export type FromPhoto = { ok: true; suggestions: Suggestion[] } | { ok: false; error?: string };

export async function suggestFromPhoto(source: "camera" | "library"): Promise<FromPhoto> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { ok: false, error: "The app was not allowed to use the camera. You can allow it in the phone's settings." };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return { ok: false };
  const asset = result.assets[0];
  try {
    const size = asset.width > asset.height ? { width: SMALL } : { height: SMALL };
    const small = await ImageManipulator.manipulate(asset.uri).resize(size).renderAsync();
    const saved = await small.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
    if (!saved.base64) throw new Error("no pixels");
    const img = jpeg.decode(fromBase64(saved.base64), { useTArray: true });
    return { ok: true, suggestions: suggestCards({ width: img.width, height: img.height, data: img.data }, storedPrints(), 3) };
  } catch {
    return { ok: false, error: "This photo could not be read. Try again, or pick the card by its name." };
  }
}
