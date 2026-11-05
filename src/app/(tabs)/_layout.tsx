import { Text } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { useTokens } from "../../ui/theme";

/** The four tabs of the build plan. The icons are plain symbols, hidden from screen readers; the tab's name is spoken. */
const ICONS: Record<string, string> = { index: "☼", tools: "✶", record: "☰", me: "◐" };

export default function TabsLayout() {
  const t = useTokens();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: t.bar },
        headerTitleStyle: { color: t.heading },
        headerTintColor: t.inkStrong,
        tabBarStyle: { backgroundColor: t.bar, borderTopColor: t.line },
        tabBarActiveTintColor: t.barActive,
        tabBarInactiveTintColor: t.barInk,
        tabBarLabelStyle: { fontSize: 12 },
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
