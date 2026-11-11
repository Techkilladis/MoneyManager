// Keystore signing is handled directly in android/app/build.gradle.
// This plugin is kept as a no-op placeholder to avoid breaking app.json plugins list.

module.exports = function withReleaseSigning(config) {
  return config; // no-op — signing is in build.gradle
};
