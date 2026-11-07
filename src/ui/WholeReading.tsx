// "The whole reading": every card of a reading laid out at once, at a size where all of it fits. The person can pinch
// to zoom in and out and drag to move around; in a browser, Ctrl and the scroll wheel (or a trackpad pinch) zoom too.
// The buttons do the same for anyone who cannot or would rather not pinch. The sums are in src/core/zoom.ts.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, View, useWindowDimensions, type GestureResponderEvent, type HostInstance } from "react-native";
import { MAX_SCALE, clampView, columnsFor, distance, fitScale, zoomAround, type Size, type View2D } from "../core/zoom";
import { ON_WEB } from "../lib/where";
import { Button } from "./kit";
import { radius, space, useTokens } from "./theme";

const STEP = 1.5;
/** How far a finger moves before a drag counts as moving the reading, so taps still turn cards over. */
const DRAG_SLOP = 6;

export function WholeReading<T>({ items, keyOf, itemWidth, renderItem }: {
  items: T[];
  keyOf: (item: T) => string;
  itemWidth: number;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const t = useTokens();
  const { height: windowHeight } = useWindowDimensions();
  const [boxWidth, setBoxWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const cols = columnsFor(items.length);
  const content: Size = { width: cols * itemWidth + (cols - 1) * space.md, height: contentHeight };
  const fit = fitScale(content, { width: boxWidth, height: windowHeight * 0.7 });
  const box: Size = { width: boxWidth, height: Math.ceil(contentHeight * fit) };
  const ready = boxWidth > 0 && contentHeight > 0;

  // The zoom itself never re-renders the cards; the buttons are brought up to date once a gesture ends.
  const [, setTick] = useState(0);
  const redraw = () => setTick((n) => n + 1);
  const redrawSoon = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scaleA = useRef(new Animated.Value(1)).current;
  const xA = useRef(new Animated.Value(0)).current;
  const yA = useRef(new Animated.Value(0)).current;
  const view = useRef<View2D>({ scale: 1, x: 0, y: 0 });
  const latest = useRef({ content, box, fit });
  latest.current = { content, box, fit };

  function show(v: View2D) {
    const { content: c, box: b, fit: f } = latest.current;
    const next = clampView(v, c, b, f);
    view.current = next;
    scaleA.setValue(next.scale);
    xA.setValue(next.x);
    yA.setValue(next.y);
  }
  const showRef = useRef(show);
  showRef.current = show;

  // Whenever the size of the space or of the cards changes, start again from the whole reading.
  useEffect(() => {
    if (ready) {
      show({ scale: 0, x: 0, y: 0 });
      redraw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, boxWidth, contentHeight, itemWidth, items.length]);

  const zoomedIn = () => view.current.scale > latest.current.fit + 0.001;
  const zoomBy = (factor: number) => {
    const b = latest.current.box;
    show(zoomAround(view.current, factor, b.width / 2, b.height / 2));
  };

  // Where the space is on the page, measured when a gesture starts, so the zoom stays under the fingers.
  const box0 = useRef<HostInstance>(null);
  const origin = useRef({ x: 0, y: 0 });
  const gesture = useRef<{ pinch?: { d: number; mx: number; my: number; view: View2D }; pan?: { dx: number; dy: number; view: View2D } }>({});
  const lastDrag = useRef(0);

  const responder = useMemo(() => {
    const points = (e: GestureResponderEvent) => {
      const n = e.nativeEvent;
      return n.touches && n.touches.length ? n.touches : [n];
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (e, g) =>
        points(e).length >= 2 || (zoomedIn() && Math.hypot(g.dx, g.dy) > DRAG_SLOP),
      onPanResponderGrant: () => {
        // A drag follows the finger from where it first touched, not from where it passed the slop.
        gesture.current = { pan: { dx: 0, dy: 0, view: view.current } };
        box0.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
          origin.current = { x: pageX, y: pageY };
        });
      },
      onPanResponderMove: (e, gs) => {
        const ts = points(e);
        const g = gesture.current;
        lastDrag.current = Date.now();
        if (ts.length >= 2) {
          const [a, b] = ts;
          const d = distance(a.pageX, a.pageY, b.pageX, b.pageY);
          const mx = (a.pageX + b.pageX) / 2 - origin.current.x;
          const my = (a.pageY + b.pageY) / 2 - origin.current.y;
          g.pan = undefined;
          if (!g.pinch || g.pinch.d <= 0) {
            g.pinch = { d, mx, my, view: view.current };
            return;
          }
          const z = zoomAround(g.pinch.view, d / g.pinch.d, g.pinch.mx, g.pinch.my);
          showRef.current({ ...z, x: z.x + mx - g.pinch.mx, y: z.y + my - g.pinch.my });
          return;
        }
        g.pinch = undefined;
        // After lifting one finger of a pinch, the other carries on moving the reading from where it is now.
        if (!g.pan) {
          g.pan = { dx: gs.dx, dy: gs.dy, view: view.current };
          return;
        }
        showRef.current({ ...g.pan.view, x: g.pan.view.x + gs.dx - g.pan.dx, y: g.pan.view.y + gs.dy - g.pan.dy });
      },
      onPanResponderRelease: () => {
        gesture.current = {};
        setTick((n) => n + 1);
      },
      onPanResponderTerminate: () => {
        gesture.current = {};
        setTick((n) => n + 1);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In a browser: Ctrl and the scroll wheel, or a trackpad pinch (which browsers send the same way), zoom around the
  // pointer. A mouse drag ends with a click on the card under it; a click just after a drag is dropped so it does not
  // turn a card over.
  useEffect(() => {
    if (!ON_WEB) return;
    const el = box0.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== "function") return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      showRef.current(zoomAround(view.current, Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.004), e.clientX - r.left, e.clientY - r.top));
      clearTimeout(redrawSoon.current);
      redrawSoon.current = setTimeout(() => setTick((n) => n + 1), 150);
    };
    const onClick = (e: MouseEvent) => {
      if (Date.now() - lastDrag.current < 400) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick, true);
      clearTimeout(redrawSoon.current);
    };
  }, []);

  const after = (fn: () => void) => () => {
    fn();
    redraw();
  };
  const atFit = !zoomedIn();
  const atMax = view.current.scale >= MAX_SCALE - 0.001;

  return (
    <View style={{ gap: space.md }}>
      <View
        ref={box0}
        onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        style={[
          {
            height: ready ? box.height : 200,
            overflow: "hidden",
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.canvas,
          },
          // In a browser, leave up-and-down scrolling of the page to the browser but keep its own pinch-to-zoom of
          // the whole page off this space, so the pinch reaches the reading. Once zoomed in, every drag moves the reading.
          ON_WEB ? ({ touchAction: atFit ? "pan-y" : "none" } as object) : null,
        ]}
      >
        <Animated.View
          onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: content.width,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: space.md,
            opacity: ready ? 1 : 0,
            transformOrigin: "0 0",
            transform: [{ translateX: xA }, { translateY: yA }, { scale: scaleA }],
          }}
        >
          {items.map((item, i) => (
            <View key={keyOf(item)}>{renderItem(item, i)}</View>
          ))}
        </Animated.View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button label="Zoom out" variant="quiet" disabled={atFit} onPress={after(() => zoomBy(1 / STEP))} />
        <Button label="Zoom in" variant="quiet" disabled={atMax} onPress={after(() => zoomBy(STEP))} />
        <Button label="Fit the whole reading" variant="quiet" disabled={atFit} onPress={after(() => show({ scale: 0, x: 0, y: 0 }))} />
      </View>
    </View>
  );
}
