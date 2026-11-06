// Design tokens, as React Native values. The dark set is the desktop app's default look (app/globals.css there);
// the light set follows its Daylight theme in spirit. The phone's own dark or light setting chooses between them.
// Screens use these names, never a hex value of their own (the desktop's design-system rule 1).

import { useColorScheme } from "react-native";
import { useComfort } from "./comfort";
import { THEMES } from "./themes-data";

export interface Tokens {
  canvas: string;
  surface: string;
  surfaceSunken: string;
  field: string;
  line: string;
  lineStrong: string;
  focus: string;
  ink: string;
  inkStrong: string;
  inkMuted: string;
  inkFaint: string;
  heading: string;
  accent: string;
  accentInk: string;
  onAccent: string;
  blush: string;
  onBlush: string;
  danger: string;
  success: string;
  warning: string;
  bar: string;
  barInk: string;
  barActive: string;
  /** The title and back arrow on the top bar. */
  barTitle: string;
}

const dark: Tokens = {
  canvas: "#0d0d1a",
  surface: "#12122a",
  surfaceSunken: "#0f0f22",
  field: "#0d0d1a",
  line: "rgba(255, 64, 222, 0.30)",
  lineStrong: "rgba(255, 64, 222, 0.44)",
  focus: "#a855f7",
  ink: "#e2e8f0",
  inkStrong: "#f1f5f9",
  inkMuted: "#b8bfcc",
  inkFaint: "#9aa1b3",
  heading: "#f0e0ff",
  accent: "#7e22ce",
  accentInk: "#d3a5ff",
  onAccent: "#ffffff",
  blush: "#fdccf5",
  onBlush: "#2b0a3d",
  danger: "#ff5c7a",
  success: "#34d399",
  warning: "#fbbf24",
  bar: "#12122a",
  barInk: "#9aa1b3",
  barActive: "#fdccf5",
  barTitle: "#f0e0ff",
};

const light: Tokens = {
  canvas: "#fbf7fd",
  surface: "#ffffff",
  surfaceSunken: "#f4ecf8",
  field: "#ffffff",
  line: "rgba(160, 30, 140, 0.22)",
  lineStrong: "rgba(160, 30, 140, 0.40)",
  focus: "#7e22ce",
  ink: "#2a2238",
  inkStrong: "#170f24",
  inkMuted: "#4f4660",
  inkFaint: "#655b78",
  heading: "#3b0764",
  accent: "#7e22ce",
  accentInk: "#6b21a8",
  onAccent: "#ffffff",
  blush: "#fdccf5",
  onBlush: "#2b0a3d",
  danger: "#be123c",
  success: "#047857",
  warning: "#92400e",
  bar: "#ffffff",
  barInk: "#655b78",
  barActive: "#8a1470",
  barTitle: "#3b0764",
};

export const radius = { card: 12, control: 8 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** The app's own two looks and the desktop's ready-made themes, by the id kept in the comfort choices. */
export function tokensFor(colours: string, phoneIsLight: boolean): { tokens: Tokens; light: boolean } {
  if (colours === "dark") return { tokens: dark, light: false };
  if (colours === "light") return { tokens: light, light: true };
  const theme = THEMES.find((th) => th.id === colours);
  if (theme) return { tokens: theme.tokens, light: theme.light };
  return phoneIsLight ? { tokens: light, light: true } : { tokens: dark, light: false };
}

export function useTokens(): Tokens {
  const scheme = useColorScheme();
  const { comfort } = useComfort();
  return tokensFor(comfort.colours, scheme === "light").tokens;
}

export function useIsDark(): boolean {
  const scheme = useColorScheme();
  const { comfort } = useComfort();
  return !tokensFor(comfort.colours, scheme === "light").light;
}
