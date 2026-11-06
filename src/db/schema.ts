// The on-device database. Every reading stays in this one SQLite file inside the app's private storage.
//
// Migrations are a numbered list. `PRAGMA user_version` holds how many have run, so a phone that skipped an app
// version still runs every step in order. Never change a step once it has shipped: add a new one at the end.
//
// The fourteen tables of the build plan. One `readings` row serves every tool (tarot today; runes, dice and the rest
// later), and `reading_pieces` holds what was drawn. There is no users table: the phone belongs to one person.

export const MIGRATIONS: string[] = [
  // 1: the first version.
  `
  CREATE TABLE readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool TEXT NOT NULL,
    question TEXT NOT NULL DEFAULT '',
    spread_id TEXT,
    spread_name TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX readings_created ON readings (created_at);

  CREATE TABLE reading_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    position_name TEXT NOT NULL DEFAULT '',
    piece_id TEXT NOT NULL,
    reversed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (reading_id, position)
  );
  CREATE INDEX reading_pieces_piece ON reading_pieces (piece_id);

  CREATE TABLE sensed_first (
    reading_id INTEGER PRIMARY KEY REFERENCES readings (id) ON DELETE CASCADE,
    guess TEXT NOT NULL DEFAULT '',
    skipped INTEGER NOT NULL DEFAULT 0,
    confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
    sealed_at TEXT NOT NULL,
    fit INTEGER CHECK (fit BETWEEN 1 AND 5),
    fit_note TEXT,
    fit_at TEXT
  );

  CREATE TABLE meanings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool TEXT NOT NULL,
    piece_id TEXT NOT NULL,
    orientation TEXT NOT NULL CHECK (orientation IN ('upright', 'reversed')),
    text TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tool, piece_id, orientation)
  );

  CREATE TABLE meaning_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meaning_id INTEGER NOT NULL REFERENCES meanings (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );

  CREATE TABLE oracle_decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    reversals INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE oracle_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER NOT NULL REFERENCES oracle_decks (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    photo_uri TEXT,
    fields TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE spreads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    positions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER REFERENCES readings (id) ON DELETE SET NULL,
    day TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX journal_entries_reading ON journal_entries (reading_id);

  CREATE TABLE predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER REFERENCES readings (id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    look_back_on TEXT,
    outcome TEXT,
    looked_back_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE reading_tags (
    reading_id INTEGER NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (reading_id, tag_id)
  );

  CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,

  // 2: oracle decks the person makes. A deck lists its own fields; each card fills them in.
  // oracle_cards.photo_uri holds either a path inside the app's own storage ("oracle-photos/abc.jpg", when
  // photo_linked is 0) or the id of a photo in the phone's photo library (when photo_linked is 1). A path is kept
  // relative, because the app's storage folder can move when the app is updated.
  // reading_pieces.piece_name keeps what a piece was called when it was drawn, so a pull still reads well after its
  // card is renamed or deleted.
  `
  ALTER TABLE oracle_decks ADD COLUMN description TEXT NOT NULL DEFAULT '';
  ALTER TABLE oracle_decks ADD COLUMN field_defs TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE oracle_cards ADD COLUMN photo_linked INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE oracle_cards ADD COLUMN updated_at TEXT;
  ALTER TABLE readings ADD COLUMN deck_id INTEGER REFERENCES oracle_decks (id) ON DELETE SET NULL;
  ALTER TABLE reading_pieces ADD COLUMN piece_name TEXT;
  CREATE INDEX oracle_cards_deck ON oracle_cards (deck_id);
  `,

  // 3: predictions and tags. A prediction keeps the words first written (original_text, never changed) beside the
  // words as reworded (text); outcome is the person's own 'yes', 'partly', 'no' or 'unclear', with their note.
  // The indexes serve the look-back list and the tag filter in Record.
  `
  ALTER TABLE predictions ADD COLUMN original_text TEXT;
  ALTER TABLE predictions ADD COLUMN outcome_note TEXT;
  CREATE INDEX predictions_reading ON predictions (reading_id);
  CREATE INDEX predictions_look_back ON predictions (look_back_on);
  CREATE INDEX reading_tags_tag ON reading_tags (tag_id);
  `,
];

/**
 * Every table, parents before children, so a backup can be put back in this order without a "parent missing" error.
 * tests/db.test.ts checks this list against the tables the migrations make.
 */
export const TABLES = [
  "oracle_decks",
  "oracle_cards",
  "readings",
  "reading_pieces",
  "sensed_first",
  "meanings",
  "meaning_history",
  "spreads",
  "journal_entries",
  "predictions",
  "tags",
  "reading_tags",
  "notes",
  "settings",
] as const;

export type TableName = (typeof TABLES)[number];
