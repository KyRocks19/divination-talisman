// The top bar of the four tabs: the tab's name on the left, "Talisman" with the logo in the middle, and a big Exit
// button on the right. The button always shows ✕; the word "Exit" beside it is dropped when the bar is too narrow
// for it (a small phone, or large text), and the button is still read out as "Exit".
// Only Android lets an app close itself, so the Exit button is shown there and nowhere else: iPhones have no way to
// quit an app from inside it, and a browser tab cannot be closed by the page.

import { useState } from "react";
import { BackHandler, Image, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { exitWordFits } from "../core/comfort";
import { useType } from "./comfort";
import { radius, space, useTokens } from "./theme";

const MARK = require("../../assets/talisman-mark.png");

/** Whether this phone lets the app close itself. */
export const CAN_EXIT = Platform.OS === "android";

/** "Talisman" and the logo, in the middle of the bar. The logo is decoration: the word is what is read out. */
export function TalismanBrand() {
  const t = useTokens();
  const type = useType();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
      <Text style={{ color: t.barTitle, ...type({ fontSize: 16, bold: "semi" }) }}>Talisman</Text>
      <Image source={MARK} style={{ width: 32, height: 32 }} accessible={false} />
    </View>
  );
}

const EXIT_PAD = space.md;
const EXIT_BORDER = 1;

/** Closes the app completely. `room` is the width the bar leaves for the button; the word "Exit" is shown only when
 * it fits there. Without a `room` the word is always shown. */
export function ExitButton({ room }: { room?: number | null }) {
  const t = useTokens();
  const type = useType();
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  if (!CAN_EXIT) return null;
  const look = { color: t.barTitle, ...type({ fontSize: 16, bold: "semi" }) };
  const showWord = room === undefined || exitWordFits(room, labelWidth, 2 * (EXIT_PAD + EXIT_BORDER));
  return (
    <View>
      {/* The full label, unseen, to learn how wide it is in the chosen font and text size. */}
      {room !== undefined && (
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", right: 0, top: 0, width: 1000, flexDirection: "row", justifyContent: "flex-end", opacity: 0 }}
        >
          <Text style={look} onLayout={(e) => setLabelWidth(Math.ceil(e.nativeEvent.layout.width))}>
            ✕ Exit
          </Text>
        </View>
      )}
      <Pressable
        onPress={() => BackHandler.exitApp()}
        accessibilityRole="button"
        accessibilityLabel="Exit"
        accessibilityHint="Closes Talisman"
        hitSlop={6}
        style={({ pressed }) => ({
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: EXIT_PAD,
          borderRadius: radius.control,
          borderWidth: EXIT_BORDER,
          borderColor: t.lineStrong,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={look}>{showWord ? "✕ Exit" : "✕"}</Text>
      </Pressable>
    </View>
  );
}

/** A tab's whole top bar: the tab's name on the left, "Talisman" and the logo in the middle, Exit on the right. The
 * two sides take equal room, so the middle stays in the centre of the screen. */
export function TalismanTabHeader({ title }: { title: string }) {
  const t = useTokens();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [exitRoom, setExitRoom] = useState<number | null>(null);
  return (
    <View
      style={{
        backgroundColor: t.bar,
        paddingTop: insets.top,
        paddingLeft: insets.left + space.lg,
        paddingRight: insets.right + space.md,
        borderBottomWidth: 1,
        borderBottomColor: t.line,
      }}
    >
      <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Text accessibilityRole="header" style={{ color: t.barTitle, ...type({ fontSize: 18, bold: "semi" }) }}>
            {title}
          </Text>
        </View>
        <TalismanBrand />
        <View style={{ flex: 1, alignItems: "flex-end" }} onLayout={(e) => setExitRoom(e.nativeEvent.layout.width)}>
          <ExitButton room={exitRoom} />
        </View>
      </View>
    </View>
  );
}
