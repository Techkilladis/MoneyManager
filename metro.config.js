// Metro configuration for the Money Manager Expo app.
// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('@expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Keep Metro's file watcher and resolver away from high-churn directories
// that are not part of the JavaScript bundle: the generated native projects
// (including the Gradle daemon's caches, which are created and removed while
// builds run), export output, and transient npm temp folders. On Windows the
// Metro fallback watcher crashes with ENOENT when a directory disappears
// between the directory walk and the fs.watch() call, which these folders
// do routinely whenever a build or npm command runs alongside Metro.
const escapeRegExpText = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Exclusions scoped to this project's root. `dist` must be anchored here:
// packages inside node_modules legitimately ship their JavaScript from
// their own `dist` folders and must keep resolving.
const rootScoped = [path.join(__dirname, 'dist') + path.sep].map(
  (dir) => new RegExp('^' + escapeRegExpText(dir))
);

const volatilePaths = [
  /[\\/]android[\\/]/,
  /[\\/]ios[\\/]/,
  /[\\/]\.expo[\\/]/,
  /[\\/]\.gradle[\\/]/,
  /[\\/]\.kotlin[\\/]/,
  /[\\/]\.idea[\\/]/,
  ...rootScoped,
  /[\\/]node_modules[\\/]\.jsdom-[^\\/]*[\\/]/,
  /[\\/]node_modules[\\/]\.cache[\\/]/,
  /[\\/]node_modules[\\/]\.staging[\\/]/,
];

// `blockList` also feeds the file map's ignore pattern, so excluded paths are
// never crawled or watched in the first place.
const existingBlockList = config.resolver.blockList;
const existingEntries = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
    ? [existingBlockList]
    : [];

config.resolver.blockList = [...existingEntries, ...volatilePaths];

module.exports = config;
