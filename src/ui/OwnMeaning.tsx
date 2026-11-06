// The person's own meaning for one piece in one orientation, with every earlier version (design rule 6).
// Shared by tarot cards and oracle cards.

import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { deleteHistoryEntry, meaningHistory, saveMeaning, type HistoryRow, type MeaningRow, type Orientation } from "../db/queries";
import { dayText } from "../lib/dates";
import { Body, Button, Card, Field, Muted } from "./kit";
import { THIS_DEVICE } from "../lib/where";

export function OwnMeaning({ tool, pieceId, orientation, row, onSaved, label }: {
  tool: string;
  pieceId: string;
  orientation: Orientation;
  row?: MeaningRow;
  onSaved: () => void;
  /** Defaults to "Your meaning, upright" or "Your meaning, reversed". */
  label?: string;
}) {
  const db = useSQLiteContext();
  const [text, setText] = useState(row?.text ?? "");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const saved = row?.text ?? "";

  useEffect(() => setText(row?.text ?? ""), [row?.text]);
  useEffect(() => {
    if (row) meaningHistory(db, row.id).then(setHistory);
    else setHistory([]);
  }, [db, row]);

  const fieldLabel = label ?? (orientation === "upright" ? "Your meaning, upright" : "Your meaning, reversed");
  return (
    <Card>
      <Field label={fieldLabel} value={text} onChangeText={setText} multiline placeholder="What does this card mean to you?" />
      {row && <Muted>Last changed {dayText(row.updated_at)}</Muted>}
      <Button
        label={text.trim() === saved ? "Saved" : text.trim() ? "Save" : "Empty it"}
        disabled={text.trim() === saved}
        onPress={async () => {
          const save = async () => {
            await saveMeaning(db, tool, pieceId, orientation, text);
            onSaved();
          };
          if (text.trim()) return save();
          Alert.alert("Empty this meaning?", `Your words and their earlier versions are deleted from ${THIS_DEVICE}.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Empty it", style: "destructive", onPress: save },
          ]);
        }}
      />
      {history.length > 0 && (
        <Button
          label={showHistory ? "Hide earlier versions" : `Earlier versions (${history.length})`}
          variant="text"
          onPress={() => setShowHistory(!showHistory)}
        />
      )}
      {showHistory &&
        history.map((h) => (
          <View key={h.id} style={{ gap: 2 }}>
            <Muted>{dayText(h.saved_at)}</Muted>
            <Body>{h.text}</Body>
            <Button
              label="Delete this version"
              variant="text"
              onPress={async () => {
                await deleteHistoryEntry(db, h.id);
                setHistory(history.filter((x) => x.id !== h.id));
              }}
            />
          </View>
        ))}
    </Card>
  );
}
