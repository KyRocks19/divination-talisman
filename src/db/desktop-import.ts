// Writes what src/core/desktop-import.ts worked out, in one transaction: if anything fails, nothing is added. Only
// adds: what the phone already has is skipped, never replaced.

import type { Db } from "./types";
import { readingKey, type DesktopImport, type ImportReport } from "../core/desktop-import";
import { ensureTag } from "./predictions";

export async function applyDesktopImport(db: Db, d: DesktopImport): Promise<ImportReport> {
  const report: ImportReport = {
    readings: { added: 0, had: 0 },
    meanings: { added: 0, had: 0 },
    predictions: { added: 0, had: 0 },
    journals: 0,
    tags: 0,
  };
  await db.withTransactionAsync(async () => {
    // What the phone has, keyed the same way as the file.
    const have = new Set(
      (
        await db.getAllAsync<{ created_at: string; ids: string | null }>(
          `SELECT r.created_at, (SELECT group_concat(piece_id, ',') FROM (SELECT piece_id FROM reading_pieces p WHERE p.reading_id = r.id ORDER BY position)) AS ids
           FROM readings r WHERE r.tool = 'tarot'`,
          [],
        )
      ).map((r) => readingKey(r.created_at, (r.ids ?? "").split(",").filter(Boolean))),
    );
    const tagsBefore = (await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM tags", []))?.n ?? 0;
    const tagIds = new Map<string, number>();
    for (const name of d.tags) tagIds.set(name.toLowerCase(), await ensureTag(db, name));

    for (const r of d.readings) {
      if (have.has(r.key)) {
        report.readings.had += 1;
        continue;
      }
      const res = await db.runAsync(
        "INSERT INTO readings (tool, question, spread_id, spread_name, notes, created_at, updated_at) VALUES ('tarot', ?, NULL, ?, ?, ?, ?)",
        [r.question, r.spreadName, r.notes, r.createdAt, r.createdAt],
      );
      const id = res.lastInsertRowId;
      for (const p of r.pieces) {
        await db.runAsync(
          "INSERT INTO reading_pieces (reading_id, position, position_name, piece_id, piece_name, reversed) VALUES (?, ?, ?, ?, ?, ?)",
          [id, p.position, p.positionName, p.pieceId, p.pieceName, p.reversed ? 1 : 0],
        );
      }
      for (const j of r.journals) {
        await db.runAsync("INSERT INTO journal_entries (reading_id, day, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [
          id,
          j.createdAt.slice(0, 10),
          j.body,
          j.createdAt,
          j.createdAt,
        ]);
        report.journals += 1;
      }
      for (const t of r.tags) {
        const tagId = tagIds.get(t.toLowerCase()) ?? (await ensureTag(db, t));
        await db.runAsync("INSERT OR IGNORE INTO reading_tags (reading_id, tag_id) VALUES (?, ?)", [id, tagId]);
      }
      have.add(r.key);
      report.readings.added += 1;
    }

    for (const m of d.meanings) {
      const own = await db.getFirstAsync<{ id: number; text: string; updated_at: string }>(
        "SELECT id, text, updated_at FROM meanings WHERE tool = 'tarot' AND piece_id = ? AND orientation = ?",
        [m.pieceId, m.orientation],
      );
      if (!own) {
        // No meaning here yet: the desktop's current one becomes the meaning, the earlier ones its history.
        const current = m.versions[m.versions.length - 1];
        const res = await db.runAsync("INSERT INTO meanings (tool, piece_id, orientation, text, updated_at) VALUES ('tarot', ?, ?, ?, ?)", [
          m.pieceId,
          m.orientation,
          current.text,
          current.savedAt,
        ]);
        for (const v of m.versions.slice(0, -1)) {
          await db.runAsync("INSERT INTO meaning_history (meaning_id, text, saved_at) VALUES (?, ?, ?)", [res.lastInsertRowId, v.text, v.savedAt]);
        }
        report.meanings.added += 1;
        continue;
      }
      // The person already wrote one here: theirs stays, and the desktop's versions join its history.
      const history = new Set(
        (await db.getAllAsync<{ text: string }>("SELECT text FROM meaning_history WHERE meaning_id = ?", [own.id])).map((h) => h.text),
      );
      history.add(own.text);
      const fresh = m.versions.filter((v) => !history.has(v.text));
      if (fresh.length === 0) {
        report.meanings.had += 1;
        continue;
      }
      for (const v of fresh) await db.runAsync("INSERT INTO meaning_history (meaning_id, text, saved_at) VALUES (?, ?, ?)", [own.id, v.text, v.savedAt]);
      report.meanings.added += 1;
    }

    const havePredictions = new Set(
      (await db.getAllAsync<{ created_at: string; first: string }>("SELECT created_at, coalesce(original_text, text) AS first FROM predictions", [])).map(
        (p) => `${new Date(p.created_at).toISOString()}|${p.first}`,
      ),
    );
    for (const p of d.predictions) {
      if (havePredictions.has(p.key)) {
        report.predictions.had += 1;
        continue;
      }
      await db.runAsync(
        `INSERT INTO predictions (reading_id, text, original_text, look_back_on, outcome, outcome_note, looked_back_at, created_at)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.words,
          p.firstWords,
          p.lookBackOn,
          p.outcome,
          p.outcomeNote,
          p.lookedBackAt,
          p.createdAt,
        ],
      );
      havePredictions.add(p.key);
      report.predictions.added += 1;
    }
    const tagsAfter = (await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM tags", []))?.n ?? 0;
    report.tags = tagsAfter - tagsBefore;
  });
  return report;
}
