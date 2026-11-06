// Sets package.json's version from a release tag such as v1.2.3, for the release build. app.config.js reads it from
// there for the Me page and the Android version code. Run as: node scripts/version-from-tag.mjs v1.2.3
import { readFileSync, writeFileSync } from "node:fs";

const tag = process.argv[2] ?? "";
const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
if (!m) {
  console.error(`Tags must look like v1.2.3, not "${tag}".`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = `${m[1]}.${m[2]}.${m[3]}`;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version set to ${pkg.version}.`);
