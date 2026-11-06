// A tool's traditional text for one piece, closed until the person opens it (design rule 1: their words come first).

import { useState } from "react";
import { View } from "react-native";
import type { PieceInfo, ToolDef } from "../core/tools";
import { Body, Button, SectionLabel } from "./kit";
import { radius, space, useTokens } from "./theme";

export function TraditionalText({ tool, piece }: { tool: ToolDef; piece: PieceInfo }) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  if (!tool.traditionalLabel || piece.traditional.length === 0) return null;
  return (
    <>
      <Button
        label={open ? `Hide ${tool.traditionalLabel.toLowerCase()}` : tool.traditionalLabel}
        variant="quiet"
        onPress={() => setOpen(!open)}
        accessibilityHint="Shows or hides the traditional text"
      />
      {open && (
        <View style={{ backgroundColor: t.surfaceSunken, borderRadius: radius.control, padding: space.md, gap: space.sm }}>
          {piece.traditional.map((x) => (
            <View key={x.label} style={{ gap: 2 }}>
              <SectionLabel>{x.label}</SectionLabel>
              <Body>{x.text}</Body>
            </View>
          ))}
        </View>
      )}
    </>
  );
}
