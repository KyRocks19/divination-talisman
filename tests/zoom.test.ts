import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCALE, clampView, columnsFor, fitScale, fitView, zoomAround } from "../src/core/zoom";

const box = { width: 400, height: 600 };

test("up to three cards sit in one row; more make a near-square block", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9, 10].map(columnsFor), [1, 2, 3, 2, 3, 3, 4]);
});

test("the fitting scale shows all of the layout and is never bigger than full size", () => {
  assert.equal(fitScale({ width: 1600, height: 1200 }, box), 0.25);
  assert.equal(fitScale({ width: 800, height: 3000 }, box), 0.2);
  assert.equal(fitScale({ width: 100, height: 100 }, box), MAX_SCALE);
  assert.equal(fitScale({ width: 0, height: 0 }, box), MAX_SCALE);
});

test("the fitted view is centred in the space", () => {
  const v = fitView({ width: 1600, height: 1200 }, box);
  assert.equal(v.scale, 0.25);
  assert.equal(v.x, 0);
  assert.equal(v.y, (600 - 300) / 2);
});

test("zooming keeps the point under the fingers in place", () => {
  const v = { scale: 0.5, x: 10, y: 20 };
  const z = zoomAround(v, 2, 110, 220);
  assert.equal(z.scale, 1);
  // The layout point under (110, 220) before: ((110-10)/0.5, (220-20)/0.5) = (200, 400). After: the same.
  assert.equal((110 - z.x) / z.scale, 200);
  assert.equal((220 - z.y) / z.scale, 400);
});

test("a view is kept between fitting and full size, and never pulled off the edges", () => {
  const content = { width: 1600, height: 1200 };
  const min = fitScale(content, box);
  assert.equal(clampView({ scale: 0.01, x: 0, y: 0 }, content, box, min).scale, min);
  assert.equal(clampView({ scale: 5, x: 0, y: 0 }, content, box, min).scale, MAX_SCALE);
  const far = clampView({ scale: 1, x: 500, y: -5000 }, content, box, min);
  assert.equal(far.x, 0);
  assert.equal(far.y, 600 - 1200);
});
