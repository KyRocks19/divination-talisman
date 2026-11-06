// How a piece of a tool is drawn: rune and ogham strokes, a card's rank and suit, a die's face, a hexagram's six
// lines, or a geomancy figure's four rows of dots. Face down it is a plain tile. Colours come from the theme.

import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Glyph as GlyphData } from "../core/tools";
import { radius, useTokens } from "./theme";

export function Glyph({ glyph, size, faceDown, reversed, label }: {
  glyph: GlyphData;
  /** The tile's width; it is 1.4 times as tall. */
  size: number;
  faceDown?: boolean;
  reversed?: boolean;
  label?: string;
}) {
  const t = useTokens();
  const h = size * 1.4;
  const tile = {
    width: size,
    height: h,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.lineStrong,
    backgroundColor: faceDown ? t.accent : t.surfaceSunken,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    transform: reversed && !faceDown ? [{ rotate: "180deg" }] : undefined,
  };
  if (faceDown) {
    return (
      <View style={tile} accessible={!!label} accessibilityLabel={label}>
        <Text style={{ color: t.onAccent, fontSize: size * 0.3 }} accessible={false}>
          ✶
        </Text>
      </View>
    );
  }
  return (
    <View style={tile} accessible={!!label} accessibilityLabel={label}>
      <Inner glyph={glyph} size={size} />
    </View>
  );
}

function Inner({ glyph, size }: { glyph: GlyphData; size: number }) {
  const t = useTokens();
  if (glyph.kind === "strokes") {
    const w = size * 0.6;
    return (
      <Svg width={w} height={w * (100 / 60)} viewBox="0 0 60 100">
        {glyph.strokes.map((d, i) => (
          <Path key={i} d={d} stroke={t.inkStrong} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
    );
  }
  if (glyph.kind === "label") {
    return (
      <Text accessible={false} numberOfLines={6} style={{ color: t.inkStrong, fontSize: Math.max(13, size * 0.12), fontWeight: "600", textAlign: "center", padding: size * 0.08 }}>
        {glyph.text}
      </Text>
    );
  }
  if (glyph.kind === "text") {
    return (
      <Text
        accessible={false}
        maxFontSizeMultiplier={1.4}
        style={{ color: glyph.red ? t.danger : t.inkStrong, fontSize: size * (glyph.text.length > 3 ? 0.24 : 0.34), fontWeight: "700" }}
      >
        {glyph.text}
      </Text>
    );
  }
  if (glyph.kind === "lines") {
    // Six lines, drawn top first: the top line is line 6.
    const barH = size * 0.07;
    const changing = new Set(glyph.changing ?? []);
    return (
      <View style={{ gap: barH * 0.9, width: size * 0.66 }}>
        {[...glyph.lines].map((yang, i) => ({ yang, n: i + 1 })).reverse().map(({ yang, n }) => (
          <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: size * 0.04 }}>
            {yang ? (
              <View style={{ flex: 1, height: barH, backgroundColor: t.inkStrong, borderRadius: 2 }} />
            ) : (
              <View style={{ flex: 1, flexDirection: "row", gap: size * 0.12 }}>
                <View style={{ flex: 1, height: barH, backgroundColor: t.inkStrong, borderRadius: 2 }} />
                <View style={{ flex: 1, height: barH, backgroundColor: t.inkStrong, borderRadius: 2 }} />
              </View>
            )}
            <Text accessible={false} style={{ width: size * 0.08, color: t.accentInk, fontSize: size * 0.08 }}>
              {changing.has(n) ? "•" : ""}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  // Geomancy: four rows, a single dot or a pair.
  const dot = size * 0.1;
  return (
    <View style={{ gap: dot * 0.8, alignItems: "center" }}>
      {glyph.lines.map((v, i) => (
        <View key={i} style={{ flexDirection: "row", gap: dot }}>
          {Array.from({ length: v }, (_, j) => (
            <View key={j} style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: t.inkStrong }} />
          ))}
        </View>
      ))}
    </View>
  );
}
