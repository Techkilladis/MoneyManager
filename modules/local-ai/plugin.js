const { withAndroidManifest, withGradleProperties, withBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin for money-manager-local-ai
 * Adds the llama.cpp native module to the Android project
 */
const withLocalAI = (config, props = {}) => {
  // Add the local-ai module to the Android build
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("project(':money-manager-local-ai')")) {
      // Add the module dependency
      const dependencyLine = "implementation project(':money-manager-local-ai')";
      const dependenciesIndex = config.modResults.contents.indexOf('dependencies {');
      if (dependenciesIndex !== -1) {
        const insertIndex = config.modResults.contents.indexOf('\n', dependenciesIndex) + 1;
        config.modResults.contents = 
          config.modResults.contents.slice(0, insertIndex) +
          `    ${dependencyLine}\n` +
          config.modResults.contents.slice(insertIndex);
      }
    }
    return config;
  });

  config = withGradleProperties(config, (config) => {
    // Add NDK version if not present
    const hasNdkVersion = config.modResults.some(p => p.key === 'android.ndkVersion');
    if (!hasNdkVersion) {
      config.modResults.push({ type: 'property', key: 'android.ndkVersion', value: '27.0.12077973' });
    }
    return config;
  });

  // Add CMake to the Android build
  config = withBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("cmake")) {
      const cmakeBlock = `
    externalNativeBuild {
        cmake {
            path "src/main/jni/CMakeLists.txt"
            version "3.18.1"
        }
    }`;
      
      const androidBlockEnd = config.modResults.contents.lastIndexOf('}');
      if (androidBlockEnd !== -1) {
        config.modResults.contents = 
          config.modResults.contents.slice(0, androidBlockEnd) +
          cmakeBlock +
          '\n' +
          config.modResults.contents.slice(androidBlockEnd);
      }
    }
    return config;
  });

  return config;
};

module.exports = { withLocalAI };