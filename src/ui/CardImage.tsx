import { Image, Text, View } from "react-native";
import { getCardById } from "../core/cards";
import { CARD_IMAGES } from "../lib/card-images";
import { radius, useTokens } from "./theme";

/** The cards are 300 x 527 pixels. */
export const CARD_RATIO = 300 / 527;

/** A card's picture, turned upside down when reversed, or its back when face down. Decorative: the name is always written beside it. */
export function CardImage({ cardId, reversed = false, faceDown = false, width }: { cardId: string; reversed?: boolean; faceDown?: boolean; width: number }) {
  const t = useTokens();
  const height = width / CARD_RATIO;
  const card = getCardById(cardId);
  if (faceDown || !card) {
    return (
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          width,
          height,
          borderRadius: radius.card,
          borderWidth: 2,
          borderColor: t.lineStrong,
          backgroundColor: t.surfaceSunken,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: t.accentInk, fontSize: width / 4 }}>✶</Text>
      </View>
    );
  }
  return (
    <Image
      source={CARD_IMAGES[card.fileName]}
      accessible={false}
      style={{ width, height, borderRadius: radius.card, transform: reversed ? [{ rotate: "180deg" }] : undefined }}
      resizeMode="cover"
    />
  );
}
