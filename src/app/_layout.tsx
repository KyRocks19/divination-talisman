import "../lib/alert-polyfill";
import { Suspense, useCallback, useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { migrate } from "../db/queries";
import { LockGate } from "../lib/lock";
import { setUpReminders, syncReminders, useReminderTaps } from "../lib/reminders";
import { ON_WEB } from "../lib/where";
import { ComfortProvider, useComfort, useType } from "../ui/comfort";
import { Loading } from "../ui/kit";
import { useIsDark, useTokens } from "../ui/theme";

// Never rename the phone's database: the readings are in it. The browser version has its own, longer name, because
// itch.io serves every HTML game from one web address, and their browser storage is shared.
export const DATABASE_NAME = ON_WEB ? "divination-talisman-readings.db" : "talisman.db";

setUpReminders();

/** Sets the phone's reminders once the database is open (never asking for permission here), and opens a tapped one. */
function Reminders() {
  const db = useSQLiteContext();
  useEffect(() => {
    syncReminders(db);
  }, [db]);
  const open = useCallback((url: string) => router.push(url as never), []);
  useReminderTaps(open);
  return null;
}

export default function RootLayout() {
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={async (db) => void (await migrate(db))} useSuspense>
        <ComfortProvider>
          <App />
        </ComfortProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

function App() {
  const t = useTokens();
  const dark = useIsDark();
  const type = useType();
  const { lessMotion } = useComfort();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Reminders />
      <LockGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.bar },
            headerTintColor: t.barTitle,
            headerTitleStyle: {
              color: t.barTitle,
              ...type({ fontSize: 18, bold: "semi" }),
            },
            contentStyle: { backgroundColor: t.canvas },
            headerBackTitle: "Back",
            animation: lessMotion ? "none" : "default",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="reading/new" options={{ title: "New reading" }} />
          <Stack.Screen name="reading/[id]" options={{ title: "Reading" }} />
          <Stack.Screen name="library" options={{ title: "Card library" }} />
          <Stack.Screen name="card/[id]" options={{ title: "Card" }} />
          <Stack.Screen name="patterns" options={{ title: "Patterns" }} />
          <Stack.Screen name="oracle/[deckId]" options={{ title: "Deck" }} />
          <Stack.Screen name="oracle/deck-edit" options={{ title: "Deck" }} />
          <Stack.Screen name="oracle/card" options={{ title: "Card" }} />
          <Stack.Screen name="predictions" options={{ title: "Predictions" }} />
          <Stack.Screen name="prediction/[id]" options={{ title: "Prediction" }} />
          <Stack.Screen name="tags" options={{ title: "Tags" }} />
          <Stack.Screen name="tool/[id]" options={{ title: "Tool" }} />
          <Stack.Screen name="piece/[tool]/[id]" options={{ title: "Meaning" }} />
          <Stack.Screen name="signs" options={{ title: "Signs and dreams" }} />
          <Stack.Screen name="note/[id]" options={{ title: "Note" }} />
          <Stack.Screen name="blind/index" options={{ title: "Blind-target practice" }} />
          <Stack.Screen name="blind/[id]" options={{ title: "Trial" }} />
        </Stack>
      </LockGate>
    </>
  );
}
