import { Suspense } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { migrate } from "../db/queries";
import { LockGate } from "../lib/lock";
import { Loading } from "../ui/kit";
import { useIsDark, useTokens } from "../ui/theme";

export const DATABASE_NAME = "talisman.db";

export default function RootLayout() {
  const t = useTokens();
  const dark = useIsDark();
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={async (db) => void (await migrate(db))} useSuspense>
        <StatusBar style={dark ? "light" : "dark"} />
        <LockGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: t.bar },
              headerTintColor: t.inkStrong,
              headerTitleStyle: { color: t.heading },
              contentStyle: { backgroundColor: t.canvas },
              headerBackTitle: "Back",
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="reading/new" options={{ title: "New reading" }} />
            <Stack.Screen name="reading/[id]" options={{ title: "Reading" }} />
            <Stack.Screen name="library" options={{ title: "Card library" }} />
            <Stack.Screen name="card/[id]" options={{ title: "Card" }} />
            <Stack.Screen name="patterns" options={{ title: "Patterns" }} />
          </Stack>
        </LockGate>
      </SQLiteProvider>
    </Suspense>
  );
}
