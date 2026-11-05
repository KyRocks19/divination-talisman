// Metro settings. The phone builds need nothing special; the two additions are only for `npm run web`, which is used to
// click through the screens in a browser: expo-sqlite's web version loads a .wasm file and needs the two
// cross-origin headers that allow SharedArrayBuffer.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

module.exports = config;
