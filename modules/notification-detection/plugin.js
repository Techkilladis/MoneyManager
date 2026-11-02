const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.READ_SMS',
  'android.permission.RECEIVE_SMS',
  // "Display over other apps": lets a new payment open the review screen.
  'android.permission.SYSTEM_ALERT_WINDOW',
  // Keeps capture working after the app is swiped away from Recents.
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
];

/**
 * Expo Config Plugin for Money Manager SMS detection.
 * Declares the SMS and pop-up permissions in the app manifest; the receiver itself is
 * declared by the native module's own manifest and merged automatically.
 */
module.exports = function withSmsDetection(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    for (const name of PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    return config;
  });
};
