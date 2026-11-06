// The "Look and comfort" part of the Me tab: the desktop app's reading comfort choices (font, text size, spacing,
// motion), its colour themes, and swiping between tabs.

import { View } from "react-native";
import { DEFAULT_COMFORT, FONT_CHOICES, FONT_FAMILIES, SIZE_CHOICES, type ComfortFont, type ComfortSize } from "../core/comfort";
import { useComfort } from "./comfort";
import { Button, Card, ChoiceRow, Divider, Muted, RadioList, ToggleRow } from "./kit";
import { THEMES } from "./themes-data";
import { radius, space, tokensFor, useTokens, type Tokens } from "./theme";

/** Three small dots in a theme's own page, card and button colours, so the choice can be seen before it is made. */
function Swatch({ tokens }: { tokens: Tokens }) {
  const t = useTokens();
  return (
    <View
      accessible={false}
      style={{ flexDirection: "row", gap: 3, padding: 4, borderRadius: radius.control, backgroundColor: tokens.canvas, borderWidth: 1, borderColor: t.line }}
    >
      {[tokens.surface, tokens.heading, tokens.blush].map((c, i) => (
        <View key={i} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c }} />
      ))}
    </View>
  );
}

export function ComfortSettings() {
  const { comfort, setComfort, fontsReady, lessMotion } = useComfort();
  const phoneDark = tokensFor("dark", false).tokens;
  const phoneLight = tokensFor("light", true).tokens;
  const isDefault = JSON.stringify(comfort) === JSON.stringify(DEFAULT_COMFORT);

  return (
    <>
      <Card>
        <RadioList<ComfortFont>
          label="Font"
          value={comfort.font}
          onChange={(font) => setComfort({ font })}
          options={FONT_CHOICES.map((f) => ({
            value: f.id,
            label: f.label,
            note: f.note,
            labelStyle: f.id !== "system" && fontsReady ? { fontFamily: FONT_FAMILIES[f.id].regular } : undefined,
          }))}
        />
        <Divider />
        <ChoiceRow<ComfortSize>
          label="Text size"
          value={comfort.size}
          onChange={(size) => size && setComfort({ size })}
          options={SIZE_CHOICES.map((s) => ({ value: s.id, label: s.label }))}
        />
        <Muted>This is on top of your phone's own text size, which the app always follows.</Muted>
        <Divider />
        <ChoiceRow
          label="Spacing"
          value={comfort.spacing}
          onChange={(spacing) => spacing && setComfort({ spacing })}
          options={[
            { value: "normal", label: "Standard" },
            { value: "roomy", label: "Roomy" },
          ]}
        />
        <Muted>Roomy puts more space between lines, letters and parts of the page.</Muted>
        <Divider />
        <ChoiceRow
          label="Motion"
          value={comfort.motion}
          onChange={(motion) => motion && setComfort({ motion })}
          options={[
            { value: "system", label: "Follow my phone" },
            { value: "less", label: "Less motion" },
          ]}
        />
        <Muted>
          {lessMotion
            ? "Pages appear without sliding in."
            : "Pages slide in as they open. Less motion, or your phone's own reduce motion setting, makes them appear without sliding."}
        </Muted>
      </Card>

      <Card>
        <RadioList
          label="Colours"
          value={comfort.colours}
          onChange={(colours) => setComfort({ colours })}
          options={[
            { value: "phone", label: "Follow my phone", note: "Dark when your phone is dark, light when it is light." },
            { value: "dark", label: "The app's dark look", note: "Always dark.", before: <Swatch tokens={phoneDark} /> },
            { value: "light", label: "The app's light look", note: "Always light.", before: <Swatch tokens={phoneLight} /> },
            ...THEMES.map((th) => ({ value: th.id, label: th.name, note: th.description.replace(/ Always your choice;.*$/, ""), before: <Swatch tokens={th.tokens} /> })),
          ]}
        />
        <Muted>The same themes as the desktop app. Every one was checked for strong contrast between text and its background.</Muted>
      </Card>

      <Card>
        <ToggleRow
          label="Swipe between tabs"
          help="Swipe left or right on a page to go to the next or previous tab. The tabs at the bottom always work too. It is off while TalkBack or VoiceOver is on."
          value={comfort.swipeTabs}
          onChange={(swipeTabs) => setComfort({ swipeTabs })}
        />
      </Card>

      {!isDefault && <Button label="Go back to the standard look" variant="text" onPress={() => setComfort(DEFAULT_COMFORT)} />}
      <View style={{ height: space.xs }} />
    </>
  );
}
