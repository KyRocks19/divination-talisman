// app.json holds the settings. This only adds the web base path for the itch.io build (scripts/build-web.mjs sets
// TALISMAN_WEB_BASE to a placeholder that the script then turns into the page's own folder at run time).
module.exports = ({ config }) => {
  const base = process.env.TALISMAN_WEB_BASE;
  if (!base) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
