// Builds the browser version as a zip for itch.io (or any web host), in dist/.
//
// itch.io serves an HTML game from a folder whose name is only known after upload
// (https://html-classic.itch.zone/html/<number>/index.html), and Expo's web export uses absolute paths. So the export
// is made with a placeholder base path, and every use of the placeholder becomes `self.__TB`: the page's own folder,
// worked out in the browser when the page opens. The same zip then works from any folder on any host.
//
// Run: npm run build:web   (or: node scripts/build-web.mjs)

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const PLACEHOLDER = "/__TBASE__";
const out = "dist/web";
const zipPath = "dist/divination-talisman-web.zip";

rmSync(out, { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", out], {
  stdio: "inherit",
  env: { ...process.env, TALISMAN_WEB_BASE: PLACEHOLDER },
  shell: process.platform === "win32",
});

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

// The page's folder, without a trailing slash ("" at the root of a site). In a worker, worked out from the worker's
// own address, which is always <folder>/_expo/static/js/web/<name>.js. When the page is cross-origin isolated, Expo
// starts the worker from a blob: wrapper that keeps the real address in ASYNC_WORKER_BASE.
const FIND_BASE =
  'self.__TB=self.__TB!==undefined?self.__TB:(typeof document!=="undefined"?location.pathname.replace(/\\/[^/]*$/,""):new URL("../../../..",new URL(typeof ASYNC_WORKER_BASE!=="undefined"?ASYNC_WORKER_BASE:location.href,location.origin)).pathname.replace(/\\/$/,""));';

const files = walk(out);
let replaced = 0;
for (const f of files.filter((f) => f.endsWith(".js"))) {
  let s = readFileSync(f, "utf8");
  if (!s.includes(PLACEHOLDER)) continue;
  // 1. Inside a JSON text that is itself a double-quoted string (the app manifest): \"/__TBASE__\".
  s = s.replaceAll(`\\"${PLACEHOLDER}\\"`, () => (replaced++, '\\""+self.__TB+"\\"'));
  // 2. A double-quoted string that starts with the placeholder: "/__TBASE__/rest" becomes (self.__TB+"/rest").
  s = s.replace(/(?<!\\)"\/__TBASE__((?:[^"\\\n]|\\.)*)"/g, (_m, rest) => (replaced++, `(self.__TB+"${rest}")`));
  if (s.includes(PLACEHOLDER)) throw new Error(`${f}: the base path is used in a way this script does not know how to change.`);
  writeFileSync(f, FIND_BASE + s);
}

const indexFile = join(out, "index.html");
let html = readFileSync(indexFile, "utf8");
html = html.replaceAll(`"${PLACEHOLDER}/`, '"./');
if (html.includes(PLACEHOLDER)) throw new Error("index.html: the base path is used in a way this script does not know how to change.");
// Before the app starts: find the folder, and show the app's home screen rather than "/index.html", which is not a
// screen.
html = html.replace(
  "<head>",
  `<head>\n    <script>${FIND_BASE}if(/\\/index\\.html$/.test(location.pathname))history.replaceState(null,"",self.__TB+"/"+location.search+location.hash);</script>`,
);
writeFileSync(indexFile, html);

const zip = {};
for (const f of walk(out)) zip[relative(out, f).split("\\").join("/")] = readFileSync(f);
writeFileSync(zipPath, zipSync(zip, { level: 6 }));
console.log(`\n${replaced} paths made relative to the page. Browser version: ${zipPath}`);
