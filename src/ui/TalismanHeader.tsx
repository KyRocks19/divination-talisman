// The top bar of the four tabs: the tab's name on the left, "Talisman" with the logo in the middle, and a big Exit
// button on the right.
// Only Android lets an app close itself, so the Exit button is shown there and nowhere else: iPhones have no way to
// quit an app from inside it, and a browser tab cannot be closed by the page.

import { BackHandler, Image, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

/** Closes the app completely. */
export function ExitButton() {
  const t = useTokens();
  const type = useType();
  if (!CAN_EXIT) return null;
  return (
    <Pressable
      onPress={() => BackHandler.exitApp()}
      accessibilityRole="button"
      accessibilityLabel="Exit"
      accessibilityHint="Closes Talisman"
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 64,
        paddingHorizontal: space.md,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: t.lineStrong,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: t.barTitle, ...type({ fontSize: 16, bold: "semi" }) }}>✕ Exit</Text>
    </Pressable>
  );
}

/** A tab's whole top bar: the tab's name on the left, "Talisman" and the logo in the middle, Exit on the right. The
 * two sides take equal room, so the middle stays in the centre of the screen. */
export function TalismanTabHeader({ title }: { title: string }) {
  const t = useTokens();
  const type = useType();
  const insets = useSafeAreaInsets();
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
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <ExitButton />
        </View>
      </View>
    </View>
  );
}
