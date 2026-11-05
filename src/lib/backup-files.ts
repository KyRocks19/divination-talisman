// The phone side of backups: gathering the oracle pictures into the zip, and putting them back after a restore.

import { allCardPhotos } from "../db/oracle";
import { makeBackup, makeBackupZip, restoreBackup, type PhoneBackup } from "../db/backup";
import type { Db } from "../db/types";
import { copyExists, linkedPhotoExists, photoBytes, writeIntoApp } from "./photos";

/** The whole backup as zip bytes, and how many pictures could not be read (a linked photo deleted from the library). */
export async function buildBackupZip(db: Db, when: Date): Promise<{ zip: Uint8Array; pictures: number; missing: number }> {
  const backup = await makeBackup(db, when);
  const pictures: { cardId: number; ext: string; bytes: Uint8Array }[] = [];
  let missing = 0;
  for (const p of await allCardPhotos(db)) {
    const got = await photoBytes({ photo: p.photo, linked: p.linked });
    if (got) pictures.push({ cardId: p.id, ...got });
    else missing += 1;
  }
  return { zip: makeBackupZip(backup, pictures), pictures: pictures.length, missing };
}

/**
 * Restores the data, then the pictures. A copy is written back into the app. A link is kept when the photo is still
 * in this phone's library; otherwise (usually a different phone) the picture from the backup becomes a copy.
 */
export async function restoreWithPictures(db: Db, backup: PhoneBackup, files: Record<string, Uint8Array>): Promise<void> {
  await restoreBackup(db, backup);
  for (const [cardId, path] of Object.entries(backup.photos ?? {})) {
    const row = await db.getFirstAsync<{ photo_uri: string | null; photo_linked: number }>("SELECT photo_uri, photo_linked FROM oracle_cards WHERE id = ?", [
      Number(cardId),
    ]);
    if (!row?.photo_uri) continue;
    // Restoring onto the same phone: the picture is still where the card points, so nothing needs writing.
    if (row.photo_linked ? await linkedPhotoExists(row.photo_uri) : copyExists(row.photo_uri)) continue;
    const bytes = files[path];
    if (!bytes) {
      await db.runAsync("UPDATE oracle_cards SET photo_uri = NULL, photo_linked = 0 WHERE id = ?", [Number(cardId)]);
      continue;
    }
    const ext = /\.([a-z0-9]{1,5})$/i.exec(path)?.[1] ?? "jpg";
    const copy = writeIntoApp(bytes, ext);
    await db.runAsync("UPDATE oracle_cards SET photo_uri = ?, photo_linked = 0 WHERE id = ?", [copy, Number(cardId)]);
  }
}
