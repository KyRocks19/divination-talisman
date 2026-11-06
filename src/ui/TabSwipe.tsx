// Swiping left or right on a tab's page goes to the next or previous tab. It is an extra: the tab bar always works,
// and the swipe can be turned off on the Me tab. It is off while a screen reader is on (TalkBack and VoiceOver use
// swipes of their own), it leaves swipes from the very edge of the screen to the phone (Android's back gesture), and
// it is off while a text field is being typed in, so selecting words never changes tabs.

import { useMemo, useRef, type ReactElement } from "react";
import { PanResponder, TextInput, View, useWindowDimensions } from "react-native";
import { router, useSegments } from "expo-router";
import { SWIPE_EDGE, TAB_ORDER, isSideways, swipeTarget, type TabName } from "../core/comfort";
import { ON_WEB } from "../lib/where";
import { useComfort } from "./comfort";

// In a browser, a mouse drag ends with a click on whatever is under the pointer; a click just after a swipe is dropped.
let lastSwipe = 0;
if (ON_WEB && typeof window !== "undefined") {
  window.addEventListener(
    "click",
    (e) => {
      if (Date.now() - lastSwipe < 600) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

/** Whether a text field has the keyboard. react-native-web has the older name for the check. */
function typingNow(): boolean {
  const state = TextInput.State as { currentlyFocusedInput?: () => unknown; currentlyFocusedField?: () => unknown };
  return !!(state.currentlyFocusedInput?.() ?? state.currentlyFocusedField?.());
}

/** Wraps a page (src/ui/kit.tsx, Screen). Only the four tab pages swipe; every other page is left as it is. */
export function TabSwipe({ children }: { children: ReactElement }) {
  const segments = useSegments() as string[];
  const tab = segments[0] === "(tabs)" ? (segments[1] ?? "index") : "";
  const go = (to: TabName) => router.navigate(to === "index" ? "/" : `/${to}`);
  const { comfort, screenReader } = useComfort();
  const { width } = useWindowDimensions();
  const on = comfort.swipeTabs && !screenReader && (TAB_ORDER as readonly string[]).includes(tab);
  const latest = useRef({ tab, go, width });
  latest.current = { tab, go, width };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Asked before the buttons and the scrolling page under the finger, so a sideways swipe anywhere on the page
        // counts; up-and-down movement and taps are left to them.
        onMoveShouldSetPanResponderCapture: (e, g) => {
          const { width: w } = latest.current;
          // Where the finger started (the gesture's own x0 is only set once this page has the touch).
          const x0 = e.nativeEvent.pageX - g.dx;
          if (x0 < SWIPE_EDGE || x0 > w - SWIPE_EDGE) return false;
          if (typingNow()) return false;
          return isSideways(g.dx, g.dy);
        },
        onPanResponderGrant: () => {
          lastSwipe = Date.now();
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_e, g) => {
          const { tab: from, go: goTo } = latest.current;
          const to = swipeTarget(from as TabName, g.dx, g.dy, g.vx);
          if (to) goTo(to);
        },
      }),
    [],
  );

  if (!on) return children;
  return (
    <View style={{ flex: 1 }} {...responder.panHandlers}>
      {children}
    </View>
  );
}
