// Me: settings, the phone lock, backups, privacy, support and credits.

import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as DocumentPicker from "expo-document-picker";
import { CRISIS_LINES } from "../../core/crisis-lines";
import { backupFileName, checkBackup, readBackupFile } from "../../db/backup";
import { buildBackupZip, restoreWithPictures } from "../../lib/backup-files";
import { getSettings, migrate, setSetting, type Settings } from "../../db/queries";
import { dayTimeText } from "../../lib/dates";
import { confirmWithLock, lockIsAvailable } from "../../lib/lock";
import { handOverFile, readPickedFile } from "../../lib/save-file";
import { HERE, THIS_DEVICE, ON_WEB } from "../../lib/where";
import { Body, Button, Card, ChoiceRow, Divider, ErrorNote, Loading, Muted, Screen, SectionLabel, Strong, ToggleRow } from "../../ui/kit";

export default function Me() {
  const db = useSQLiteContext();
  const [s, setS] = useState<Settings | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSettings(db).then(setS);
    }, [db]),
  );

  if (!s) return <Loading />;

  async function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    await setSetting(db, key, value);
    setS(await getSettings(db));
  }

  async function toggleLock(on: boolean) {
    setError(null);
    if (on && !(await lockIsAvailable())) {
      setError("This phone has no Face ID, fingerprint or passcode set up, so the app cannot be locked. Set one up in the phone's settings first.");
      return;
    }
    // Ask once now, so the person knows the lock works before relying on it.
    if (!(await confirmWithLock(on ? "Turn on the lock" : "Turn off the lock"))) return;
    await change("lock", on);
  }

  async function backUp() {
    setError(null);
    setNote(null);
    try {
      const when = new Date();
      const made = await buildBackupZip(db, when);
      if (!(await handOverFile(backupFileName(when), made.zip))) {
        setError("This phone cannot open the save or share sheet, so the backup file could not be handed over.");
        return;
      }
      await change("lastBackupAt", when.toISOString());
      const missing = made.missing
        ? ` ${made.missing} ${made.missing === 1 ? "card photo is" : "card photos are"} no longer in your photo library, so ${made.missing === 1 ? "it is" : "they are"} not in the file.`
        : "";
      setNote(`Backup file made. Keep it somewhere that is not only ${THIS_DEVICE}, such as Files, iCloud Drive or Google Drive.${missing}`);
    } catch (e) {
      setError(`The backup could not be made: ${(e as Error).message}`);
    }
  }

  async function restore() {
    setError(null);
    setNote(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ["application/zip", "application/json", "*/*"], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    let read: { text: string; files: Record<string, Uint8Array> };
    try {
      read = readBackupFile(await readPickedFile(picked.assets[0].uri));
    } catch {
      setError("This file is not a Divination Talisman backup.");
      return;
    }
    const checked = checkBackup(read.text);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    Alert.alert(
      `Replace everything ${HERE}?`,
      `This backup is from ${dayTimeText(checked.backup.created)} and holds ${checked.rows} items. Everything now ${HERE} will be replaced by it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace",
          style: "destructive",
          onPress: async () => {
            try {
              await restoreWithPictures(db, checked.backup, read.files);
              await migrate(db);
              setS(await getSettings(db));
              setNote(`Your backup is back ${HERE}.`);
            } catch (e) {
              setError(`Nothing was changed. The backup could not be put back: ${(e as Error).message}`);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <SectionLabel>Practice</SectionLabel>
      <Card>
        <ToggleRow
          label="Write what you sense first"
          help="Before cards are turned over, write a first impression. You can always skip it for one reading."
          value={s.senseFirst}
          onChange={(v) => change("senseFirst", v)}
        />
        <Divider />
        <ToggleRow label="Reversed cards" help="Cards can come up upside down." value={s.reversals} onChange={(v) => change("reversals", v)} />
      </Card>

{ON_WEB ? (
        <>
      <SectionLabel>Photos for your oracle cards</SectionLabel>
      <Card>
        <Muted>
          In the browser version, each photo is kept as a smaller copy with its card, in this browser. A browser cannot link to your photo
          library.
        </Muted>
      </Card>

        </>
      ) : (
        <>
      <SectionLabel>Photos for your oracle cards</SectionLabel>
      <Card>
        <ChoiceRow
          label="When you add a photo"
          options={[
            { value: "copy", label: "Keep a copy in the app" },
            { value: "link", label: "Link to your photo library" },
          ]}
          value={s.photoMode}
          onChange={(v) => v && change("photoMode", v)}
        />
        <Muted>
          {s.photoMode === "copy"
            ? "The app keeps its own copy of each photo. It uses more space, and the card keeps its picture even if you delete the photo from your library."
            : "The app points to the photo in your library and keeps no copy, so it uses no extra space. If you delete the photo from your library, the card loses its picture. Photos you take with the camera are saved to your library first."}
        </Muted>
        <Muted>This applies to photos you add from now on. Backup files always hold a copy of every picture.</Muted>
      </Card>

      <SectionLabel>Lock</SectionLabel>
      <Card>
        <ToggleRow
          label="Lock the app"
          help="Ask for Face ID, a fingerprint or the phone's passcode when the app opens."
          value={s.lock}
          onChange={toggleLock}
        />
      </Card>

        </>
      )}

      <SectionLabel>Backup</SectionLabel>
      <Card>
        <Body>
          {ON_WEB
            ? "Your readings are kept only in this browser, on this device. If the browser's data for this page is cleared, they are gone, unless you have a backup file."
            : "Your readings are kept only on this phone. If the phone is lost or the app is deleted, they are gone, unless you have a backup file."}
        </Body>
        {ON_WEB && (
          <Muted>
            On an iPhone or iPad, Safari can clear what a website keeps when you have not opened it for 7 days. Open the app at least once a
            week, and make a backup file often.
          </Muted>
        )}
        <Muted>{s.lastBackupAt ? `Last backup: ${dayTimeText(s.lastBackupAt)}` : "No backup made yet."}</Muted>
        <Button label="Make a backup file" onPress={backUp} />
        <Button label="Restore from a backup file" variant="quiet" onPress={restore} />
      </Card>
      {note && <Body accessibilityLiveRegion="polite">{note}</Body>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <SectionLabel>Privacy</SectionLabel>
      <Card>
        <Body>
          {ON_WEB
            ? "Nothing you write leaves this browser. The app has no account, no server, no analytics and no crash reports, and once the page has loaded it makes no connections. A backup file goes only where you send it. itch.io, which hosts the page, has its own privacy policy."
            : "Nothing leaves this phone. The app has no account, no server, no analytics and no crash reports, and it makes no connections. A backup file goes only where you send it."}
        </Body>
      </Card>

      <SectionLabel>If you need support</SectionLabel>
      <Card>
        <Body>{CRISIS_LINES}</Body>
        <Button label="Open findahelpline.com" variant="text" onPress={() => Linking.openURL("https://findahelpline.com")} />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card>
        <Strong>Divination Talisman</Strong>
        <Muted>
          A phone edition of Divination Station. You are the author of every meaning here; the app is a mirror for your own intuition.
        </Muted>
        <Muted>
          Card pictures: Pamela Colman Smith's 1909 drawings, in the public domain; scans cleaned by Luciella Elisabeth Scarlett. Card texts by
          Felix G and Kylie B. Code under the GNU AGPL 3.0. Details are in the NOTICE file.
        </Muted>
      </Card>
    </Screen>
  );
}
