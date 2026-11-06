// The phone lock: when the person turns it on, the app asks for Face ID, a fingerprint or the phone's passcode when it
// opens and each time it comes back from the background. Nothing is shown behind the lock screen.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useSQLiteContext } from "expo-sqlite";
import { getSettings } from "../db/queries";
import { Body, Button, Loading, Title } from "../ui/kit";
import { space, useTokens } from "../ui/theme";

/** The browser version has no lock: a browser cannot ask for Face ID or the phone's passcode. */
export const LOCK_SUPPORTED = Platform.OS !== "web";

export async function lockIsAvailable(): Promise<boolean> {
  if (!LOCK_SUPPORTED) return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function confirmWithLock(reason: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
  return r.success;
}

export function LockGate({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const t = useTokens();
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const lockOn = useRef(false);

  const unlock = useCallback(async () => {
    if (await confirmWithLock("Open Divination Talisman")) setState("open");
  }, []);

  useEffect(() => {
    getSettings(db).then((s) => {
      // A backup from a phone can carry the lock setting; a browser could never unlock, so it is ignored there.
      lockOn.current = s.lock && LOCK_SUPPORTED;
      if (lockOn.current) {
        setState("locked");
        unlock();
      } else setState("open");
    });
    const sub = AppState.addEventListener("change", async (next) => {
      if (next !== "background") return;
      lockOn.current = (await getSettings(db)).lock && LOCK_SUPPORTED;
      if (lockOn.current) setState("locked");
    });
    return () => sub.remove();
  }, [db, unlock]);

  if (state === "checking") return <Loading />;
  if (state === "locked") {
    return (
      <View style={{ flex: 1, backgroundColor: t.canvas, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.lg }}>
        <Title>Locked</Title>
        <Body style={{ textAlign: "center" }}>Your readings are kept on this phone. Unlock to open them.</Body>
        <Button label="Unlock" onPress={unlock} />
      </View>
    );
  }
  return <>{children}</>;
}
