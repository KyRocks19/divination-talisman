// app.json holds the settings. This adds two things:
// - The version, from package.json, so it is written in one place. The Me page shows it, and the Android version
//   code is made from it (1.2.3 becomes 10203): Android only installs an update with a higher version code than the
//   one a phone has. A release build sets package.json's version from its tag first (.github/workflows/android-apk.yml).
// - The web base path for the itch.io build (scripts/build-web.mjs sets TALISMAN_WEB_BASE to a placeholder that the
//   script then turns into the page's own folder at run time).
const { version } = require("./package.json");

function versionCode(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`package.json's version must look like 1.2.3, not "${v}".`);
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

module.exports = ({ config }) => {
  const out = { ...config, version, android: { ...config.android, versionCode: versionCode(version) } };
  const base = process.env.TALISMAN_WEB_BASE;
  if (base) out.experiments = { ...config.experiments, baseUrl: base };
  return out;
};
