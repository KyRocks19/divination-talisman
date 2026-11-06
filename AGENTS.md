# Divination Talisman: notes for coding sessions

The phone edition of Divination Station: a tarot app that evolves with the person to help them tune their own
intuition. Every reading stays on the phone. No server, no accounts, no analytics, no network connections. The plan
is the doc "Divination Station Mobile: build plan"; the desktop app is `KyRocks19/divination-station-takeoff`.

When a change is done and the checks below pass, push its branch and open a pull request to `main`. Never push straight
to `main`.

## Expo has changed: do not trust your training data

This is Expo SDK 58 with React Native 0.88 and Expo Router 58. APIs you remember may be renamed or moved. Read the
type definitions in `node_modules/<package>/build/*.d.ts` before using an API. Known differences:
- `Tabs` comes from `expo-router/js-tabs` (the `expo-router` export is deprecated).
- `expo-file-system` is the `File` / `Paths` / `Directory` API (`new File(Paths.cache, name).write(text)`).
- Add packages with `EXPO_OFFLINE=1 npx expo install <package>` when Expo's API cannot be reached; it uses the
  versions bundled with the `expo` package.
- Routes live in `src/app/`. Keep non-route code out of it. Never create `ios/` or `android/` by hand.

## Rules

1. **The person is the only author.** Their meanings are shown first; the built-in text is behind a button labelled
   "Pixie-Smith meanings". Never score, grade or correct. Counts are plain counts.
2. **Write what you sense first** comes before every reveal, is one tap to skip, and can be turned off.
3. **Keep history.** Changing a meaning adds a version (`meaning_history`); emptying it is the person's choice.
4. **Everything can be edited, emptied and deleted** by the person.
5. **Nothing leaves the phone** except a backup file or shared text the person sends themselves. No analytics, crash
   reporting or update checks.
6. **Tokens, not colours.** Screens use `useTokens()` from `src/ui/theme.ts` and the pieces in `src/ui/kit.tsx`; no
   hex values in screens (data colours for spread positions are the exception).
7. **Plain, literal words** in the interface. Follow the phone's text size; never turn font scaling off.
8. **Migrations:** add a new string at the end of `MIGRATIONS` in `src/db/schema.ts`; never change one that has
   shipped. A new table goes in `TABLES` too (parents first), and the backup round-trip test must still pass.
9. **Pure logic goes in `src/core/`** with a test in `tests/`. Queries go in `src/db/queries.ts` and are tested on
   Node's SQLite through `tests/node-db.ts`.

## Before committing

`npm test` and `npm run typecheck` must pass. For screen changes, run `npm run web` and click through at phone width
(390 x 844), or open it in Expo Go.
