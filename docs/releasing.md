# Releasing on itch.io, for free

Nothing here needs a paid account. Expo itself is free, open-source software (MIT licence). Its paid part is an
optional cloud build service (EAS), and this app does not use it: GitHub builds the Android file instead. The app
stores' fees (Apple $99 a year, Google $25 once) only matter for the stores, and itch.io is not a store that charges.

## What people get

An Android app file (`.apk`) that they download from itch.io and open on their phone. Android asks them once to allow
installing apps from their browser or files app. iPhones cannot install an app file from outside the App Store, so
iPhone users need a browser version (not built yet).

## One-time setup: the app's signing key

Every Android app is signed with a key. A phone only installs an update over the version it has when both are signed
with **the same key**. With a different key, the person has to uninstall first, and uninstalling deletes every reading
on that phone. So the key is made once, used for every release, and kept safe for good.

1. Keep the key file (`talisman-release.keystore`) and its password somewhere safe that is not only one computer,
   such as a password manager. If it is lost, people can only move to a new version by making a backup, uninstalling,
   installing the new one and restoring the backup.
2. On GitHub, open the repository, then **Settings > Secrets and variables > Actions > New repository secret**, and
   add four secrets:

   | Name | Value |
   |---|---|
   | `TALISMAN_KEYSTORE_BASE64` | the whole text of `talisman-release.keystore.base64.txt` |
   | `TALISMAN_KEYSTORE_PASSWORD` | the password |
   | `TALISMAN_KEY_ALIAS` | `talisman` |
   | `TALISMAN_KEY_PASSWORD` | the same password |

To make a new key on your own computer instead (needs Java):

```
keytool -genkeypair -v -storetype PKCS12 -keystore talisman-release.keystore -alias talisman -keyalg RSA -keysize 4096 -validity 36500
```

Then turn it into text for the first secret: on Windows PowerShell,
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("talisman-release.keystore")) > talisman-release.keystore.base64.txt`.

## Each release

1. Pick the next version number, higher than the last one: `v0.1.0`, then `v0.1.1`, `v0.2.0` and so on. Android
   refuses an update whose number is not higher than the one on the phone.
2. On GitHub, open **Releases > Draft a new release**, type the tag (for example `v0.1.0`) in "Choose a tag" and
   create it on `main`, then publish. Or from a terminal: `git tag v0.1.0` and `git push origin v0.1.0`.
3. The **Android APK** workflow builds the app (about 15 minutes) and attaches
   `divination-talisman-0.1.0-release.apk` to that release.
4. Download that file and upload it to your itch.io project: **Edit game > Uploads > Upload files**, and tick
   **Android** for its platform. Set the project's "Kind of project" to **Downloadable**.

Test builds: every pull request also builds an APK, found on the workflow run's page under **Artifacts**. Its name
ends in `-test` when it was signed with the public debug key. Those are for trying the app out, never for itch.io.

## What to tell people on the itch.io page

- Their readings are kept only on their phone, and the app makes no connections.
- They should make a backup file from **Me > Backup** now and then, and always before uninstalling.
- To update, they download the new file and open it. Their readings stay.
