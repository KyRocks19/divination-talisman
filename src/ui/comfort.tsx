// Holds the person's comfort choices (src/core/comfort.ts) for every screen, loads the fonts they can choose, and
// listens for the phone's own "reduce motion" setting. The choices are kept with the settings in the database, so a
// backup carries them.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { useFonts } from "expo-font";
import { useSQLiteContext } from "expo-sqlite";
// One file per weight, so only these four are bundled, not every weight in the packages.
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible/400Regular";
import { AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible/700Bold";
import { Lexend_400Regular } from "@expo-google-fonts/lexend/400Regular";
import { Lexend_700Bold } from "@expo-google-fonts/lexend/700Bold";
import { DEFAULT_COMFORT, gapFor, lessMotion, parseComfort, textLook, type Comfort, type TextBase, type TextLook } from "../core/comfort";
import { getTextSetting, setTextSetting } from "../db/queries";
import { ON_WEB } from "../lib/where";
import { THEMES } from "./themes-data";

export const COMFORT_KEY = "comfort";
const THEME_IDS = THEMES.map((th) => th.id);

interface ComfortState {
  comfort: Comfort;
  setComfort: (change: Partial<Comfort>) => void;
  fontsReady: boolean;
  /** The phone's own "reduce motion" setting, or the choice here. */
  lessMotion: boolean;
  /** A screen reader (TalkBack or VoiceOver) is on. */
  screenReader: boolean;
}

const Ctx = createContext<ComfortState>({
  comfort: DEFAULT_COMFORT,
  setComfort: () => undefined,
  fontsReady: false,
  lessMotion: false,
  screenReader: false,
});

function usePhoneSetting(read: () => Promise<boolean>, event: "reduceMotionChanged" | "screenReaderChanged"): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    read()
      .then((v) => live && setOn(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(event, (v: boolean) => setOn(v));
    return () => {
      live = false;
      sub?.remove();
    };
  }, [read, event]);
  return on;
}

export function ComfortProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [comfort, setState] = useState<Comfort>(DEFAULT_COMFORT);
  const [fontsReady] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    Lexend_400Regular,
    Lexend_700Bold,
    "OpenDyslexic-Regular": require("../../assets/fonts/OpenDyslexic-Regular.otf"),
    "OpenDyslexic-Bold": require("../../assets/fonts/OpenDyslexic-Bold.otf"),
  });
  const reduce = usePhoneSetting(AccessibilityInfo.isReduceMotionEnabled, "reduceMotionChanged");
  // A browser cannot tell whether a screen reader is on (react-native-web always says yes), so there it counts as off.
  const screenReaderOn = usePhoneSetting(AccessibilityInfo.isScreenReaderEnabled, "screenReaderChanged");
  const screenReader = !ON_WEB && screenReaderOn;

  useEffect(() => {
    getTextSetting(db, COMFORT_KEY).then((raw) => setState(parseComfort(raw, THEME_IDS)));
  }, [db]);

  const setComfort = useCallback(
    (change: Partial<Comfort>) => {
      setState((old) => {
        const next = { ...old, ...change };
        setTextSetting(db, COMFORT_KEY, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    },
    [db],
  );

  const value = useMemo(
    () => ({ comfort, setComfort, fontsReady, lessMotion: lessMotion(comfort, reduce), screenReader }),
    [comfort, setComfort, fontsReady, reduce, screenReader],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Reloads the choices from the database, after a backup has been put back. */
export function useReloadComfort() {
  const db = useSQLiteContext();
  const { setComfort } = useContext(Ctx);
  return useCallback(async () => setComfort(parseComfort(await getTextSetting(db, COMFORT_KEY), THEME_IDS)), [db, setComfort]);
}

export function useComfort(): ComfortState {
  return useContext(Ctx);
}

/** A function that gives the text style for a base size, in the chosen font, size and spacing. */
export function useType(): (base: TextBase) => TextLook {
  const { comfort, fontsReady } = useComfort();
  return useCallback((base) => textLook(comfort, base, fontsReady), [comfort, fontsReady]);
}

/** The gap between parts of a page, roomier when asked for. */
export function useGap(): (gap: number) => number {
  const { comfort } = useComfort();
  return useCallback((gap: number) => gapFor(comfort, gap), [comfort]);
}
