// Signs the Android release build with the app's own key, read from environment variables at build time, so the key
// never sits in the repository. The GitHub workflow (.github/workflows/android-apk.yml) sets them from the repository's
// secrets. Without them the release build falls back to the template's debug key, which is fine for testing but must
// never be used for a release: a phone only installs an update signed with the same key as the version it has, so a
// change of key forces an uninstall, and an uninstall deletes the readings on the phone.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// with-release-signing";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;

    gradle = gradle.replace(
      /signingConfigs \{\n/,
      `signingConfigs {
        ${MARK}
        release {
            def ks = System.getenv("TALISMAN_KEYSTORE_FILE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("TALISMAN_KEYSTORE_PASSWORD")
                keyAlias System.getenv("TALISMAN_KEY_ALIAS")
                keyPassword System.getenv("TALISMAN_KEY_PASSWORD")
            }
        }
`,
    );

    // In buildTypes.release, use the release key when one was given, else the debug key as before.
    gradle = gradle.replace(
      /(release \{\n(\s*)\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      `$1signingConfig System.getenv("TALISMAN_KEYSTORE_FILE") ? signingConfigs.release : signingConfigs.debug`,
    );

    if (!gradle.includes('System.getenv("TALISMAN_KEYSTORE_FILE") ? signingConfigs.release')) {
      throw new Error("with-release-signing: the Android template has changed; update plugins/with-release-signing.js.");
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
