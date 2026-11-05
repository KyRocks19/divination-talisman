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

Not yet built (see the build plan): predictions with look-back notifications, tags, the other
tools (runes, dice and coins, pendulum, I Ching, ogham, geomancy, playing cards, lots, signs and dreams, blind target),
import from the desktop app's backup, a browser version for iPhones, and app store builds.

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
