// The top bar of the four tabs: the tab's name, then "Talisman" with the logo, then a big Exit button.
// Only Android lets an app close itself, so the Exit button is shown there and nowhere else: iPhones have no way to
// quit an app from inside it, and a browser tab cannot be closed by the page.

import { BackHandler, Image, Platform, Pressable, Text, View } from "react-native";
import { useType } from "./comfort";
import { radius, space, useTokens } from "./theme";

const MARK = require("../../assets/talisman-mark.png");

/** Whether this phone lets the app close itself. */
export const CAN_EXIT = Platform.OS === "android";

/** "Talisman" and the logo, on the right of the bar. The logo is decoration: the word is what is read out. */
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

/** Everything on the right of a tab's top bar. */
export function TalismanHeaderRight() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginRight: space.md }}>
      <TalismanBrand />
      <ExitButton />
    </View>
  );
}
