// Oracle card pictures, on the phone. Two ways to keep one, chosen in Me:
// - "copy": the picture is copied into the app's own storage (oracle-photos/), so it stays even if the original is
//   deleted. Costs space.
// - "link": the app keeps only the id of the photo in the phone's photo library, so no space is used twice. If the
//   photo is deleted from the library, the card loses its picture.
// Backups always hold the picture itself, either way, so a backup is complete on its own.

import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { randomUUID } from "expo-crypto";

const FOLDER = "oracle-photos";

export interface PhotoRef {
  photo: string;
  linked: boolean;
}

function folder(): Directory {
  const d = new Directory(Paths.document, FOLDER);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

function extOf(uri: string): string {
  const m = /\.([a-z0-9]{1,5})(?:\?|$)/i.exec(uri);
  return m ? m[1].toLowerCase() : "jpg";
}

/** Copies a picture into the app's storage and returns its path there, relative to the app's documents folder. */
export function copyIntoApp(uri: string): string {
  const name = `${randomUUID()}.${extOf(uri)}`;
  const target = new File(folder(), name);
  new File(uri).copySync(target);
  return `${FOLDER}/${name}`;
}

export function writeIntoApp(bytes: Uint8Array, ext: string): string {
  const name = `${randomUUID()}.${ext}`;
  const target = new File(folder(), name);
  target.create();
  target.write(bytes);
  return `${FOLDER}/${name}`;
}

/** Whether the app's own copy is still in its storage. */
export function copyExists(path: string): boolean {
  try {
    return new File(Paths.document, path).exists;
  } catch {
    return false;
  }
}

/** Deletes the app's own copy. A linked photo is never touched: it belongs to the person's photo library. */
export function deletePhoto(ref: PhotoRef | null): void {
  if (!ref || ref.linked) return;
  try {
    const f = new File(Paths.document, ref.photo);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

export type Picked = { ok: true; ref: PhotoRef; note?: string } | { ok: false; error?: string };

/**
 * Takes a photo or picks one from the library, and keeps it the way the setting says. When a link is not possible
 * (the person allowed only some photos, or Android did not give an id), it falls back to a copy and says so.
 */
export async function pickPhoto(source: "camera" | "library", mode: "copy" | "link"): Promise<Picked> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, allowsEditing: false };
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { ok: false, error: "The app was not allowed to use the camera. You can allow it in the phone's settings." };
  }
  if (mode === "link") {
    // Reading the library by id needs the library permission, asked for only when linking is chosen.
    const perm = await requestPermissionsAsync(false, ["photo"]);
    if (!perm.granted) {
      mode = "copy";
    }
  }
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return { ok: false };
  const asset = result.assets[0];

  if (mode === "link") {
    try {
      if (source === "camera") {
        // A new photo is saved to the library first, so there is something to link to.
        const saved = await Asset.create(asset.uri);
        return { ok: true, ref: { photo: saved.id, linked: true }, note: "The photo was saved to your photo library and linked." };
      }
      if (asset.assetId) return { ok: true, ref: { photo: asset.assetId, linked: true } };
    } catch {
      // Fall through to a copy.
    }
    return { ok: true, ref: { photo: copyIntoApp(asset.uri), linked: false }, note: "This photo could not be linked, so a copy was kept in the app instead." };
  }
  return { ok: true, ref: { photo: copyIntoApp(asset.uri), linked: false } };
}

export type PickedMany = { ok: true; refs: PhotoRef[]; copied: number } | { ok: false; error?: string };

/**
 * Picks many photos from the library at once, in the order they were tapped, and keeps each the way the setting says.
 * `copied` counts the ones that were meant to be linked but had to be copied instead.
 */
export async function pickPhotos(mode: "copy" | "link"): Promise<PickedMany> {
  if (mode === "link") {
    const perm = await requestPermissionsAsync(false, ["photo"]);
    if (!perm.granted) mode = "copy";
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
  });
  if (result.canceled || !result.assets?.length) return { ok: false };
  const refs: PhotoRef[] = [];
  let copied = 0;
  for (const asset of result.assets) {
    if (mode === "link" && asset.assetId) {
      refs.push({ photo: asset.assetId, linked: true });
      continue;
    }
    if (mode === "link") copied++;
    try {
      refs.push({ photo: copyIntoApp(asset.uri), linked: false });
    } catch {
      // All or nothing: copies already made for this batch are deleted again.
      for (const r of refs) deletePhoto(r);
      return { ok: false, error: "A photo could not be copied into the app. Nothing was added." };
    }
  }
  return { ok: true, refs, copied };
}

const linkedUris = new Map<string, string | null>();

/** A URI an image can be shown from, or null when the picture is gone. Library links are looked up once and remembered. */
export async function displayUri(ref: PhotoRef | null): Promise<string | null> {
  if (!ref?.photo) return null;
  if (!ref.linked) {
    const f = new File(Paths.document, ref.photo);
    return f.exists ? f.uri : null;
  }
  if (linkedUris.has(ref.photo)) return linkedUris.get(ref.photo) ?? null;
  try {
    const uri = await new Asset(ref.photo).getUri();
    linkedUris.set(ref.photo, uri);
    return uri;
  } catch {
    linkedUris.set(ref.photo, null);
    return null;
  }
}

/** The picture's bytes and file type, for a backup; null when it cannot be read. */
export async function photoBytes(ref: PhotoRef): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const uri = await displayUri(ref);
    if (!uri) return null;
    const bytes = await new File(uri).bytes();
    return { bytes, ext: extOf(ref.linked ? uri : ref.photo) };
  } catch {
    return null;
  }
}

/** Whether a linked photo is still in this phone's library (after a restore onto another phone it usually is not). */
export async function linkedPhotoExists(id: string): Promise<boolean> {
  linkedUris.delete(id);
  return (await displayUri({ photo: id, linked: true })) !== null;
}
