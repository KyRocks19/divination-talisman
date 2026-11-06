// The version is written once, in package.json; app.config.js passes it to the app (the Me page shows it) and makes
// the Android version code from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const makeConfig = require("../app.config.js") as (a: { config: Record<string, any> }) => Record<string, any>;
const pkg = require("../package.json") as { version: string };
const appJson = require("../app.json") as { expo: Record<string, any> };

test("the app's version comes from package.json", () => {
  const out = makeConfig({ config: appJson.expo });
  assert.equal(out.version, pkg.version);
  const [a, b, c] = pkg.version.split(".").map(Number);
  assert.equal(out.android.versionCode, a * 10000 + b * 100 + c);
  assert.equal(out.android.package, appJson.expo.android.package);
});

test("app.json does not keep a second copy of the version", () => {
  assert.equal(appJson.expo.version, undefined);
  assert.equal(appJson.expo.android.versionCode, undefined);
});
