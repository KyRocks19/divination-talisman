# Releasing on itch.io, for free

Nothing here needs a paid account. Expo itself is free, open-source software (MIT licence). Its paid part is an
optional cloud build service (EAS), and this app does not use it: GitHub builds the Android file instead. The app
stores' fees (Apple $99 a year, Google $25 once) only matter for the stores, and itch.io is not a store that charges.

## What people get

An Android app file (`.apk`) that they download from itch.io and open on their phone. Android asks them once to allow
installing apps from their browser or files app. iPhones cannot install an app file from outside the App Store, so
iPhone users (and anyone else) can use the browser version instead, played right on the itch.io page. Both are built
from the same code by the same workflow, so every release has the same features in both.

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
   refuses an update whose number is not higher than the one on the phone. The build writes the tag's number into
   `package.json`, and the Me page and the Android version code both come from there, so nothing else needs editing.
   (Outside a release, the app shows whatever `version` says in `package.json`.)
2. On GitHub, open **Releases > Draft a new release**, type the tag (for example `v0.1.0`) in "Choose a tag" and
   create it on `main`, then publish. Or from a terminal: `git tag v0.1.0` and `git push origin v0.1.0`.
3. The **Android APK and browser version** workflow builds both (about 20 minutes) and attaches
   `divination-talisman-0.1.0-release.apk` and `divination-talisman-0.1.0-web.zip` to that release.
4. Download both files. On your itch.io project, open **Edit game**:
   - Set **Kind of project** to **HTML**.
   - Under **Uploads**, upload the `-web.zip` and tick **This file will be played in the browser**.
   - Upload the `.apk` too and tick **Android** for it, so Android users can download it.
   - Under **Embed options**: tick **Mobile friendly** (orientation: portrait), set the viewport to 390 x 844 or
     tick **Click to launch in fullscreen**, and tick **SharedArrayBuffer support**. The browser version keeps its
     readings in a small database inside the browser, and that database needs this option; without it the page stops
     at the loading screen.
   - Save, then open the page on your phone to check that a reading can be drawn.

Test builds: every pull request also builds an APK and a browser zip, found on the workflow run's page under
**Artifacts**. Its name
ends in `-test` when it was signed with the public debug key. Those are for trying the app out, never for itch.io.

## What to tell people on the itch.io page

- Their readings are kept only on their phone, and the app makes no connections.
- They should make a backup file from **Me > Backup** now and then, and always before uninstalling.
- To update, they download the new file and open it. Their readings stay.
- **Browser version:** their readings are kept only in that browser on that device, not on itch.io. A new release
  keeps them: itch.io serves every HTML game from the same web address, and the browser keeps storage by address.
  Safari on iPhones and iPads can clear what a website keeps after 7 days without a visit, so they should open it at
  least once a week and make a backup file often (**Me > Backup**). Backups move between the phone app and the
  browser version in both directions.

## Building the browser version yourself

`npm run build:web` makes `dist/divination-talisman-web.zip`. Expo's web export uses absolute paths, and itch.io
serves the game from a folder whose name is only known after upload, so `scripts/build-web.mjs` builds with a
placeholder base path and turns every use of it into the page's own folder, worked out when the page opens. The zip
works from any folder on any web host that sends the two cross-origin isolation headers
(`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`).
