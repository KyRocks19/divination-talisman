import { router } from "expo-router";
import { BUILT_IN_SPREADS } from "../../core/spreads";
import { Card, Muted, Screen, SectionLabel, Strong } from "../../ui/kit";

export default function Tools() {
  return (
    <Screen>
      <SectionLabel>Tarot</SectionLabel>
      {BUILT_IN_SPREADS.map((s) => (
        <Card
          key={s.id}
          onPress={() => router.push({ pathname: "/reading/new", params: { spread: s.id } })}
          accessibilityLabel={`${s.name}, ${s.positions.length} ${s.positions.length === 1 ? "card" : "cards"}`}
          accessibilityHint="Starts a reading with this spread"
        >
          <Strong>{s.name}</Strong>
          <Muted>
            {s.positions.length} {s.positions.length === 1 ? "card" : "cards"} · {s.description}
          </Muted>
        </Card>
      ))}

      <SectionLabel>Learn</SectionLabel>
      <Card onPress={() => router.push("/library")} accessibilityHint="Opens the 78 cards">
        <Strong>Card library</Strong>
        <Muted>All 78 cards, with your own meanings first.</Muted>
      </Card>

      <SectionLabel>Coming later</SectionLabel>
      <Muted>
        Your own oracle deck, runes, dice and coins, the pendulum, the I Ching, ogham, geomancy, playing cards, lots, signs and dreams, and
        blind-target practice.
      </Muted>
    </Screen>
  );
}
