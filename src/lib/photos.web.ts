// Oracle card pictures in the browser version (Metro picks this file over photos.ts for web).
//
// A browser cannot link to the phone's photo library and has no app folder, so a picture is always kept as a copy,
// inside the card itself: a JPEG data URL in `photo_uri`, made smaller first (at most MAX_SIDE pixels on its long side)
// so the browser's storage is not filled by a few large photos. `linked` is always false here.

import * as ImagePicker from "expo-image-picker";

export interface PhotoRef {
  photo: string;
  linked: boolean;
}

export type Picked = { ok: true; ref: PhotoRef; note?: string } | { ok: false; error?: string };

const MAX_SIDE = 1400;
const QUALITY = 0.85;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromDataUrl(url: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const type = m[1].toLowerCase();
  return { bytes, ext: type === "jpeg" ? "jpg" : type.replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg" };
}

/** Loads a picture and redraws it no larger than MAX_SIDE, as a JPEG data URL. */
async function shrink(uri: string): Promise<string> {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize pictures.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export function copyIntoApp(): string {
  throw new Error("Not used in the browser version: pickPhoto keeps the picture in the card.");
}

export function writeIntoApp(bytes: Uint8Array, ext: string): string {
  const type = ext.toLowerCase() === "jpg" ? "jpeg" : ext.toLowerCase();
  return `data:image/${type};base64,${toBase64(bytes)}`;
}

/** The picture is inside the card, so it is there whenever the card is. */
export function copyExists(path: string): boolean {
  return path.startsWith("data:image/");
}

/** Nothing to delete: the picture goes with the card's row. */
export function deletePhoto(): void {}

/**
 * Takes a photo (on a phone, the browser offers the camera) or chooses one. The setting for linking does not apply in
 * a browser; the picture is always kept as a copy.
 */
export async function pickPhoto(source: "camera" | "library", mode: "copy" | "link"): Promise<Picked> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false };
  try {
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return { ok: false };
    const photo = await shrink(result.assets[0].uri);
    return {
      ok: true,
      ref: { photo, linked: false },
      note: mode === "link" ? "In the browser version a photo is always kept as a copy, because a browser cannot link to your photo library." : undefined,
    };
  } catch {
    return { ok: false, error: "This picture could not be opened. Try a JPEG or PNG photo." };
  }
}

export async function displayUri(ref: PhotoRef | null): Promise<string | null> {
  return ref?.photo && ref.photo.startsWith("data:image/") ? ref.photo : null;
}

export async function photoBytes(ref: PhotoRef): Promise<{ bytes: Uint8Array; ext: string } | null> {
  return fromDataUrl(ref.photo);
}

/** A browser has no photo library, so a link from a phone's backup is never found here; the backup's copy is used. */
export async function linkedPhotoExists(): Promise<boolean> {
  return false;
}
