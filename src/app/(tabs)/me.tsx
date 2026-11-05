// Me: settings, the phone lock, backups, privacy, support and credits.

import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { CRISIS_LINES } from "../../core/crisis-lines";
import { backupFileName, checkBackup, makeBackup, restoreBackup } from "../../db/backup";
import { getSettings, migrate, setSetting, type Settings } from "../../db/queries";
import { dayTimeText } from "../../lib/dates";
import { confirmWithLock, lockIsAvailable } from "../../lib/lock";
import { Body, Button, Card, Divider, ErrorNote, Loading, Muted, Screen, SectionLabel, Strong, ToggleRow } from "../../ui/kit";

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
      const backup = await makeBackup(db, when);
      const file = new File(Paths.cache, backupFileName(when));
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(backup));
      if (!(await Sharing.isAvailableAsync())) {
        setError("This phone cannot open the save or share sheet, so the backup file could not be handed over.");
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: "Save your backup" });
      await change("lastBackupAt", when.toISOString());
      setNote("Backup file made. Keep it somewhere that is not only this phone, such as Files, iCloud Drive or Google Drive.");
    } catch (e) {
      setError(`The backup could not be made: ${(e as Error).message}`);
    }
  }

  async function restore() {
    setError(null);
    setNote(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const text = await new File(picked.assets[0].uri).text();
    const checked = checkBackup(text);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    Alert.alert(
      "Replace everything on this phone?",
      `This backup is from ${dayTimeText(checked.backup.created)} and holds ${checked.rows} items. Everything now on this phone will be replaced by it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace",
          style: "destructive",
          onPress: async () => {
            try {
              await restoreBackup(db, checked.backup);
              await migrate(db);
              setS(await getSettings(db));
              setNote("Your backup is back on this phone.");
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

      <SectionLabel>Lock</SectionLabel>
      <Card>
        <ToggleRow
          label="Lock the app"
          help="Ask for Face ID, a fingerprint or the phone's passcode when the app opens."
          value={s.lock}
          onChange={toggleLock}
        />
      </Card>

      <SectionLabel>Backup</SectionLabel>
      <Card>
        <Body>
          Your readings are kept only on this phone. If the phone is lost or the app is deleted, they are gone, unless you have a backup file.
        </Body>
        <Muted>{s.lastBackupAt ? `Last backup: ${dayTimeText(s.lastBackupAt)}` : "No backup made yet."}</Muted>
        <Button label="Make a backup file" onPress={backUp} />
        <Button label="Restore from a backup file" variant="quiet" onPress={restore} />
      </Card>
      {note && <Body accessibilityLiveRegion="polite">{note}</Body>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <SectionLabel>Privacy</SectionLabel>
      <Card>
        <Body>
          Nothing leaves this phone. The app has no account, no server, no analytics and no crash reports, and it makes no connections. A
          backup file goes only where you send it.
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
