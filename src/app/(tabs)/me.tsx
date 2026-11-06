// Me: settings, the phone lock, backups, privacy, support and credits.

import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import Constants from "expo-constants";
import { useSQLiteContext } from "expo-sqlite";
import * as DocumentPicker from "expo-document-picker";
import { CRISIS_LINES } from "../../core/crisis-lines";
import { backupFileName, checkBackup, readBackupFile } from "../../db/backup";
import { buildBackupZip, restoreWithPictures } from "../../lib/backup-files";
import { getSettings, migrate, setSetting, type Settings } from "../../db/queries";
import { dayTimeText } from "../../lib/dates";
import { confirmWithLock, lockIsAvailable } from "../../lib/lock";
import { handOverFile, readPickedFile } from "../../lib/save-file";
import { REMINDERS_AVAILABLE, syncReminders } from "../../lib/reminders";
import { strFromU8 } from "fflate";
import { checkDesktopExport, reportLines } from "../../core/desktop-import";
import { applyDesktopImport } from "../../db/desktop-import";
import { HERE, THIS_DEVICE, ON_WEB } from "../../lib/where";
import { useReloadComfort } from "../../ui/comfort";
import { ComfortSettings } from "../../ui/ComfortSettings";
import { Body, Button, Card, ChoiceRow, Divider, ErrorNote, Loading, Muted, Screen, SectionLabel, Strong, ToggleRow } from "../../ui/kit";

/** The version in app.json; a release build gets it from its tag (.github/workflows/android-apk.yml). */
const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

export default function Me() {
  const db = useSQLiteContext();
  const [s, setS] = useState<Settings | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reloadComfort = useReloadComfort();

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

  async function toggleReminder(key: "lookBackReminders" | "backupReminders", on: boolean) {
    setError(null);
    setNote(null);
    await change(key, on);
    const ok = await syncReminders(db, { ask: on });
    if (on && !ok) {
      setError("The phone is not allowing reminders for this app. You can allow them in the phone's settings, under Notifications.");
    }
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
      await syncReminders(db);
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
      setError("This file is not a Talisman backup.");
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
              await syncReminders(db);
              await reloadComfort();
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

  async function bringInFromDesktop() {
    setError(null);
    setNote(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    let text: string;
    try {
      text = strFromU8(await readPickedFile(picked.assets[0].uri));
    } catch {
      setError("This file could not be read.");
      return;
    }
    const checked = checkDesktopExport(text);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    const d = checked.data;
    Alert.alert(
      "Bring this in?",
      `${d.exportedAt ? `Exported ${dayTimeText(d.exportedAt)}. ` : ""}It has ${d.readings.length} tarot readings, ${d.meanings.length} card meanings and ${d.predictions.length} predictions. They are added ${HERE}; anything already here is skipped, and nothing here is changed or deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Bring it in",
          onPress: async () => {
            try {
              const report = await applyDesktopImport(db, d);
              await syncReminders(db);
              setNote(reportLines(report, d).join(" "));
            } catch (e) {
              setError(`Nothing was added. The file could not be brought in: ${(e as Error).message}`);
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

      <SectionLabel>Look and comfort</SectionLabel>
      <ComfortSettings />

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

      {REMINDERS_AVAILABLE && (
        <>
          <SectionLabel>Reminders</SectionLabel>
          <Card>
            <ToggleRow
              label="Look-back days"
              help="On the day you chose to look back on a prediction, the phone reminds you at 9 in the morning."
              value={s.lookBackReminders}
              onChange={(v) => toggleReminder("lookBackReminders", v)}
            />
            <Divider />
            <ToggleRow
              label="Backups"
              help="30 days after your last backup file, the phone reminds you to make a new one."
              value={s.backupReminders}
              onChange={(v) => toggleReminder("backupReminders", v)}
            />
            <Muted>Reminders are set on this phone. They never show your questions or what you wrote, and nothing is sent anywhere.</Muted>
            <Button label="Open the phone's settings" variant="text" onPress={() => Linking.openSettings().catch(() => undefined)} />
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

      <SectionLabel>From the desktop app</SectionLabel>
      <Card>
        <Body>Bring your tarot readings, journal entries, tags, card meanings and predictions over from Divination Station.</Body>
        <Muted>
          In the desktop app, open Settings and download your data as JSON. Put the file somewhere this {ON_WEB ? "browser" : "phone"} can open,
          then choose it here. It only adds: nothing {HERE} is changed or deleted, and bringing in the same file twice adds nothing new.
        </Muted>
        <Button label="Choose the desktop export file" variant="quiet" onPress={bringInFromDesktop} />
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
        <Strong>Talisman</Strong>
        <Muted>
          A phone edition of Divination Station. You are the author of every meaning here; the app is a mirror for your own intuition.
        </Muted>
        <Muted>
          Card pictures: Pamela Colman Smith's 1909 drawings, in the public domain; scans cleaned by Luciella Elisabeth Scarlett. Card texts by
          Felix G and Kylie B. Code under the GNU AGPL 3.0. Details are in the NOTICE file.
        </Muted>
      </Card>
      <Muted accessibilityRole="text" style={{ textAlign: "center" }}>
        Talisman, version {APP_VERSION}
      </Muted>
    </Screen>
  );
}
