import { Text } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { useType } from "../../ui/comfort";
import { TalismanHeaderRight } from "../../ui/TalismanHeader";
import { useTokens } from "../../ui/theme";

/** The four tabs of the build plan. The icons are plain symbols, hidden from screen readers; the tab's name is spoken. */
const ICONS: Record<string, string> = { index: "☼", tools: "✶", record: "☰", me: "◐" };

export default function TabsLayout() {
  const t = useTokens();
  const type = useType();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: t.bar },
        headerTitleStyle: { color: t.barTitle, ...type({ fontSize: 18, bold: "semi" }) },
        headerTintColor: t.barTitle,
        // The tab's name on the left; "Talisman", the logo and Exit on the right.
        headerTitleAlign: "left",
        headerRight: () => <TalismanHeaderRight />,
        tabBarStyle: { backgroundColor: t.bar, borderTopColor: t.line },
        tabBarActiveTintColor: t.barActive,
        tabBarInactiveTintColor: t.barInk,
        // The chosen font, but not the chosen size: a bigger label would not fit under its icon. The phone's own text size
        // still applies.
        tabBarLabelStyle: { fontSize: 12, fontFamily: type({ fontSize: 12 }).fontFamily },
        sceneStyle: { backgroundColor: t.canvas },
        tabBarIcon: ({ color, size }) => (
          <Text accessible={false} style={{ color, fontSize: size - 2 }}>
            {ICONS[route.name] ?? "•"}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="tools" options={{ title: "Tools" }} />
      <Tabs.Screen name="record" options={{ title: "Record" }} />
      <Tabs.Screen name="me" options={{ title: "Me" }} />
    </Tabs>
  );
}
