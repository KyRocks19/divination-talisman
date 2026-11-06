// Choosing which reading to look back on and write about, on the Today tab. A button shows the choice; it opens a
// full-screen list (with search) where each reading is a radio button, so it works with a screen reader and with large text.

import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { firstPiece, lookBackState, pickerGroups, readingTitle } from "../core/look-back";
import { FIT_LABELS, type Fit } from "../core/guess-core";
import { listReadings, PIECE_NAME_SEPARATOR, type ReadingListItem } from "../db/queries";
import { dayText } from "../lib/dates";
import { useType } from "./comfort";
import { Button, Field, Muted, SectionLabel } from "./kit";
import { radius, space, useTokens } from "./theme";

export function readingLine(r: ReadingListItem): string {
  const first = firstPiece(r, PIECE_NAME_SEPARATOR);
  return `${dayText(r.created_at)}${first ? ` · ${first}` : ""}`;
}

function stateWords(r: ReadingListItem): string {
  const s = lookBackState(r);
  if (s === "waiting") return "Ready to look back on";
  if (s === "looked-back") return `Looked back: ${FIT_LABELS[r.fit as Fit]}`;
  return "Nothing sensed first";
}

type Item = { kind: "journal" } | { kind: "label"; text: string } | { kind: "reading"; r: ReadingListItem };

export function ReadingPicker({ visible, chosen, onChoose, onClose }: {
  visible: boolean;
  chosen: number | null;
  onChoose: (id: number | null) => void;
  onClose: () => void;
}) {
  const db = useSQLiteContext();
  const t = useTokens();
  const type = useType();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReadingListItem[]>([]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    listReadings(db, search, 300).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [db, search, visible]);

  const { waiting, others } = pickerGroups(rows);
  const items: Item[] = [
    ...(search.trim() ? [] : [{ kind: "journal" } as Item]),
    ...(waiting.length ? [{ kind: "label", text: "Ready to look back on" } as Item, ...waiting.map((r) => ({ kind: "reading", r }) as Item)] : []),
    ...(others.length ? [{ kind: "label", text: waiting.length ? "Other readings" : "Readings" } as Item, ...others.map((r) => ({ kind: "reading", r }) as Item)] : []),
  ];

  function Row({ on, title, lines, onPress }: { on: boolean; title: string; lines: string[]; onPress: () => void }) {
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={[title, ...lines].join(". ")}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: t.surface,
          borderColor: on ? t.blush : t.line,
          borderWidth: on ? 2 : 1,
          borderRadius: radius.card,
          padding: space.md,
          gap: 2,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: t.inkStrong, ...type({ fontSize: 16, bold: "semi" }) }}>
          {on ? "✓ " : ""}
          {title}
        </Text>
        {lines.map((l, i) => (
          <Muted key={i} numberOfLines={2}>
            {l}
          </Muted>
        ))}
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} animationType="none" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: t.canvas, padding: space.lg, gap: space.md }} accessibilityViewIsModal>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
          <Text accessibilityRole="header" style={{ color: t.heading, flex: 1, ...type({ fontSize: 22, bold: true }) }}>
            Choose a reading
          </Text>
          <Button label="Close" variant="text" onPress={onClose} />
        </View>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="A word from the question, notes or journal" />
        <FlatList
          data={items}
          keyExtractor={(it, i) => (it.kind === "reading" ? `r${it.r.id}` : `${it.kind}${i}`)}
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="radiogroup"
          ListEmptyComponent={<Muted>{search.trim() ? "No readings have these words." : "No readings yet."}</Muted>}
          renderItem={({ item }) => {
            if (item.kind === "label") return <SectionLabel>{item.text}</SectionLabel>;
            if (item.kind === "journal") {
              return <Row on={chosen === null} title="My own journal" lines={["Not about any one reading"]} onPress={() => onChoose(null)} />;
            }
            const r = item.r;
            return (
              <Row
                on={chosen === r.id}
                title={readingTitle(r)}
                lines={[readingLine(r), stateWords(r), ...(r.guess && !r.skipped ? [`You sensed: ${r.guess}`] : [])]}
                onPress={() => onChoose(r.id)}
              />
            );
          }}
        />
      </View>
    </Modal>
  );
}
