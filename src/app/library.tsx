import { Pressable, SectionList, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { TAROT_DECK, type Suit, type TarotCard } from "../core/cards";
import { CardImage } from "../ui/CardImage";
import { space, useTokens } from "../ui/theme";

const SUITS: { suit: Suit; title: string }[] = [
  { suit: "major", title: "Major Arcana" },
  { suit: "cups", title: "Cups" },
  { suit: "pentacles", title: "Pentacles" },
  { suit: "swords", title: "Swords" },
  { suit: "wands", title: "Wands" },
];

const COLUMNS = 3;

/** Cards in rows of three, since a SectionList cannot lay out a grid by itself. */
function rows(cards: TarotCard[]): TarotCard[][] {
  const out: TarotCard[][] = [];
  for (let i = 0; i < cards.length; i += COLUMNS) out.push(cards.slice(i, i + COLUMNS));
  return out;
}

export default function Library() {
  const t = useTokens();
  const { width } = useWindowDimensions();
  const cardWidth = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;
  const sections = SUITS.map((s) => ({ title: s.title, data: rows(TAROT_DECK.filter((c) => c.suit === s.suit)) }));
  return (
    <SectionList
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      sections={sections}
      keyExtractor={(row) => row[0].id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={{ color: t.heading, fontSize: 20, fontWeight: "700", marginTop: space.md }}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <View style={{ flexDirection: "row", gap: space.md }}>
          {item.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/card/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={c.name}
              style={({ pressed }) => ({ width: cardWidth, gap: space.xs, opacity: pressed ? 0.8 : 1 })}
            >
              <CardImage cardId={c.id} width={cardWidth} />
              <Text style={{ color: t.ink, fontSize: 13, textAlign: "center" }} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    />
  );
}
