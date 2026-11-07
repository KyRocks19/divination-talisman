// The sums behind "The whole reading": every card of a reading laid out at once, which the person can pinch (or
// ctrl-scroll in a browser) to see all of it or move in closer. Kept here, away from the screen, so they can be tested.

export interface Size {
  width: number;
  height: number;
}

/** Where the cards are drawn: moved by x and y, then made bigger or smaller by scale from the top left corner. */
export interface View2D {
  scale: number;
  x: number;
  y: number;
}

/** Closest the person can zoom in: the cards at the size they have in the row above. */
export const MAX_SCALE = 1;

/** How many cards go across: up to three sit in one row, in order; more make a block about as wide as it is tall. */
export function columnsFor(count: number): number {
  if (count <= 3) return Math.max(1, count);
  return Math.ceil(Math.sqrt(count));
}

/** The scale at which the whole layout fits the space it is shown in (never bigger than full size). */
export function fitScale(content: Size, box: Size): number {
  if (content.width <= 0 || content.height <= 0 || box.width <= 0 || box.height <= 0) return MAX_SCALE;
  return Math.min(MAX_SCALE, box.width / content.width, box.height / content.height);
}

/** The whole layout shown at the fitting scale, in the middle of the space. */
export function fitView(content: Size, box: Size): View2D {
  const scale = fitScale(content, box);
  return clampView({ scale, x: 0, y: 0 }, content, box, scale);
}

/**
 * Keeps a view in bounds: the scale between the fitting scale and full size, and the layout never pulled away from
 * the edges. Along a side where the layout is smaller than the space it is centred.
 */
export function clampView(v: View2D, content: Size, box: Size, minScale: number): View2D {
  const scale = Math.min(MAX_SCALE, Math.max(minScale, v.scale));
  return { scale, x: clampAxis(v.x, content.width * scale, box.width), y: clampAxis(v.y, content.height * scale, box.height) };
}

function clampAxis(offset: number, shown: number, room: number): number {
  if (shown <= room) return (room - shown) / 2;
  return Math.min(0, Math.max(room - shown, offset));
}

/**
 * Zooms by a factor around a point in the space (the middle of two fingers, or the mouse), so the part of the reading
 * under that point stays under it. The result still needs clampView.
 */
export function zoomAround(v: View2D, factor: number, px: number, py: number): View2D {
  const scale = v.scale * factor;
  const k = scale / v.scale;
  return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

/** The distance between two fingers. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}
