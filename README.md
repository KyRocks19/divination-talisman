# Divination Talisman

The phone edition of [Divination Station](https://github.com/KyRocks19/divination-station-takeoff): a tarot app that
helps a person tune their own intuition. Every reading stays on the phone. There is no account, no server and no
sign-in, and the app makes no network connections.

Built with Expo (React Native) and on-device SQLite, for iPhone and Android from one codebase.

## What is in this first version

- **Four tabs:** Today, Tools, Record, Me.
- **Tarot readings** with the four built-in spreads (Single Card, Past | Present | Future, Situation | Challenge |
  Advice | Outcome, Celtic Cross). Cards are drawn with the phone's secure random numbers, saved at the moment of
  drawing, and opened face down. Tap a card to turn it over (with a light buzz), or swipe between cards.
- **Write what you sense first:** before the cards are drawn, write a first impression and how sure you feel. It is
  sealed with the time and shown beside the cards. Later you say how well it fitted. Skip it for one reading, or turn
  it off in Me.
- **Your own meanings first:** every card has your upright and reversed meaning, with every earlier version kept. The
  built-in text waits behind a "Pixie-Smith meanings" button.
- **Record:** every reading, newest first, with search over questions, notes, what you sensed and journal entries.
  Each reading has notes, journal entries, share as text, and delete.
- **Patterns:** plain counts of your first impressions and how you said they fitted, how sure you felt against how it
  fitted, and cards that keep coming up. Nothing is graded.
- **Card library:** all 78 cards.
- **Oracle decks you make yourself** (Tools): name a deck, add your own fields (such as Element or Keywords), and add
  cards with a photo taken or chosen from the library. Each card has your meanings with their history. Pull from the
  deck with any spread it has enough cards for; pulls go into Record and Patterns like tarot readings.
- **Card photos:** kept as a copy in the app, or linked to the photo in the phone's library so no space is used twice
  (chosen in Me). Linking needs a real build; Expo Go may ask for full photo access or fall back to a copy.
- **Me:** sense-first and reversals switches, a Face ID, fingerprint or passcode lock, photo copy or link, backup to one zip
  file (with every card picture) and restore from it (older .json backups still restore), privacy, support lines, credits.

- **Other tools** (Tools): runes, ogham, playing cards, dice and coins, the I Ching (coins or yarrow odds, with
  changing lines), geomancy (a sixteen-figure chart), lots from your own list, and the pendulum (you note how it swung).
  Each has a page of its pieces with your own meanings; any traditional text is behind a button. Readings from every
  tool go into Record, Patterns, tags, predictions and backups.
- **Predictions:** after any reading, write what you expect and choose a day to look back. The first words are kept
  beside any rewording; when the day comes, say what happened. Due ones show on Today; plain counts in Patterns.
- **Reminders** (phone only): a notification on a prediction's look-back day, and 30 days after the last backup. They
  are set on the phone with no push service and never show your words. Two switches in Me.
- **Tags:** on any reading; Record filters by tag, search finds them, and a Tags screen renames or deletes them.
- **Signs and dreams** and **blind-target practice** (Tools).
- **From the desktop app** (Me): bring in the JSON file from Divination Station's Settings export. It only adds.
- **Look back and journal** (Today): choose any reading from a list (the ones waiting to be looked back on come first),
  say how well what you sensed fitted, and keep journal entries about it, or about no reading at all. Entries can be
  changed and deleted.
- **Look and comfort** (Me): the desktop's reading comfort choices (Atkinson Hyperlegible, Lexend or OpenDyslexic; four
  text sizes on top of the phone's own; roomy spacing; less motion, which also follows the phone's reduce motion
  setting), its eight colour themes, and swiping left or right between tabs (off while TalkBack or VoiceOver is on).
- **The app's version** at the bottom of Me.

Not built: tea leaves, ink blots, scrying, charm casting, bibliomancy, cloths, the encyclopedia, the AI
companion, and app store builds.

## The browser version

The same code also runs in a browser, for iPhones and anyone without Android, as an HTML game on itch.io.
`npm run build:web` makes `dist/divination-talisman-web.zip`, and every release attaches it next to the APK
(`docs/releasing.md`). In a browser the readings stay in that browser's storage. There is no lock, photos are always
kept as a smaller copy with their card, backups are downloaded or shared, and the app reminds people to back up after
7 days, because Safari can clear a website's storage after 7 days without a visit. Files ending in `.web.ts` are the
browser's versions of the phone-only parts.

## Running it

```
npm install
npm start          # then open it in Expo Go on your phone (scan the QR code)
npm test           # the logic and database tests, on Node's own SQLite
npm run typecheck
```

To release it on itch.io for free (an Android app file built by GitHub, with no Expo account), see
[docs/releasing.md](docs/releasing.md).

`npm run web` opens it in a browser, which is useful for clicking through the screens; the phone is the real target.

## Where things are

| Path | What |
|---|---|
| `src/app/` | The screens (Expo Router: every file is a route) |
| `src/core/` | Pure logic and data with no phone or database code: the deck, spreads, drawing, sense-first counting, patterns, share text. Several files are copied from the desktop app's `lib/` |
| `src/db/` | The schema (`schema.ts`, numbered migrations), every query (`queries.ts`), backup and restore (`backup.ts`) |
| `src/ui/` | Design tokens (`theme.ts`) and the shared pieces (`kit.tsx`, `CardImage.tsx`) |
| `src/lib/` | Phone-side helpers: secure random numbers, the lock, dates, card pictures |
| `tests/` | `node --test` tests. `tests/node-db.ts` runs the app's real queries on Node's SQLite |

## Licence

Code: GNU AGPL 3.0 only (`LICENSE`). Card pictures and card text: see `NOTICE`.
