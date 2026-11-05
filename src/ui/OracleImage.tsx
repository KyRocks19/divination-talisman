import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { displayUri, type PhotoRef } from "../lib/photos";
import { CARD_RATIO } from "./CardImage";
import { radius, useTokens } from "./theme";

/**
 * An oracle card's picture at tarot proportions: the person's photo, its back when face down, or the card's name on a
 * plain face when it has no picture (or its linked photo was deleted from the library). Decorative: the name is
 * always written beside it.
 */
export function OracleImage({ photo, name, width, faceDown = false, reversed = false }: {
  photo: PhotoRef | null;
  name: string;
  width: number;
  faceDown?: boolean;
  reversed?: boolean;
}) {
  const t = useTokens();
  const height = width / CARD_RATIO;
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setUri(null);
    if (!faceDown) displayUri(photo).then((u) => live && setUri(u));
    return () => {
      live = false;
    };
  }, [photo?.photo, photo?.linked, faceDown]);

  const frame = {
    width,
    height,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: t.lineStrong,
    backgroundColor: t.surfaceSunken,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
    padding: 8,
  };

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[frame, reversed && !faceDown ? { transform: [{ rotate: "180deg" }] } : null]}>
      {faceDown ? (
        <Text style={{ color: t.accentInk, fontSize: width / 4 }}>✶</Text>
      ) : uri ? (
        <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
      ) : (
        <Text style={{ color: t.heading, fontSize: Math.max(12, width / 9), textAlign: "center" }} numberOfLines={4}>
          {name}
        </Text>
      )}
    </View>
  );
}
