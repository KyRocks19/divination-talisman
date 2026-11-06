// Handing a backup file to the person, and reading the file they pick. The browser version is in save-file.web.ts.

import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

/** Opens the phone's save or share sheet for the file. False when the phone has none. */
export async function handOverFile(name: string, bytes: Uint8Array): Promise<boolean> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "Save your backup" });
  return true;
}

export async function readPickedFile(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
