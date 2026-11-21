const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Finds the index of the matching closing brace '}' for the opening brace at openBraceIndex,
 * properly ignoring braces inside strings (single and double quotes) and comments.
 *
 * @param {string} content
 * @param {number} openBraceIndex
 * @returns {number} Index of the matching closing brace, or -1 if not found.
 */
function findMatchingBrace(content, openBraceIndex) {
  let depth = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let i = openBraceIndex + 1;

  while (i < content.length && depth > 0) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    const nextChar = i + 1 < content.length ? content[i + 1] : '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
    } else if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
    } else if (inSingleQuote) {
      if (char === '\'' && prevChar !== '\\') {
        inSingleQuote = false;
      }
    } else if (inDoubleQuote) {
      if (char === '"' && prevChar !== '\\') {
        inDoubleQuote = false;
      }
    } else {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++;
      } else if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
      } else if (char === '\'') {
        inSingleQuote = true;
      } else if (char === '"') {
        inDoubleQuote = true;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
    i++;
  }
  return -1;
}

/**
 * Finds a named Groovy block like `signingConfigs { ... }` or `buildTypes { ... }`.
 *
 * @param {string} content
 * @param {string} blockName
 * @param {number} [fromIndex=0]
 * @returns {{ start: number, openBrace: number, closeBrace: number, inner: string } | null}
 */
function findBlock(content, blockName, fromIndex = 0) {
  const regex = new RegExp(`\\b${blockName}\\s*\\{`, 'g');
  regex.lastIndex = fromIndex;
  const match = regex.exec(content);
  if (!match) return null;

  const start = match.index;
  const openBrace = content.indexOf('{', start);
  const closeBrace = findMatchingBrace(content, openBrace);
  if (closeBrace === -1) return null;

  return {
    start,
    openBrace,
    closeBrace,
    inner: content.substring(openBrace + 1, closeBrace),
  };
}

/**
 * Generates the Groovy DSL block for signingConfigs.release.
 *
 * @param {string} indent
 * @param {string} eol
 * @returns {string}
 */
function generateReleaseBlock(indent = '    ', eol = '\n') {
  return [
    `${indent}release {`,
    `${indent}    def keystorePath = System.getenv("ANDROID_KEYSTORE_PATH") ?: findProperty("ANDROID_KEYSTORE_PATH") ?: "release.keystore"`,
    `${indent}    def keystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: findProperty("ANDROID_KEYSTORE_PASSWORD")`,
    `${indent}    def keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: findProperty("ANDROID_KEY_ALIAS")`,
    `${indent}    def keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: findProperty("ANDROID_KEY_PASSWORD")`,
    ``,
    `${indent}    if (keystorePassword && keyAlias && keyPassword && file(keystorePath).exists()) {`,
    `${indent}        storeFile file(keystorePath)`,
    `${indent}        storePassword keystorePassword`,
    `${indent}        keyAlias keyAlias`,
    `${indent}        keyPassword keyPassword`,
    `${indent}    }`,
    `${indent}}`,
  ].join(eol);
}

/**
 * Declaratively modifies the contents of `android/app/build.gradle` to:
 * 1. Add `signingConfigs.release` reading environment variables / Gradle project properties.
 * 2. Update `buildTypes.release` to conditionally use `signingConfigs.release` or fall back to debug.
 *
 * This function is idempotent: running it repeatedly on the same Gradle content will not duplicate blocks.
 * It also preserves whether the input file uses LF or CRLF line endings.
 *
 * @param {string} buildGradle
 * @returns {string}
 */
function modifyAppBuildGradle(buildGradle) {
  const isCRLF = buildGradle.includes('\r\n');
  const eol = isCRLF ? '\r\n' : '\n';
  let content = buildGradle;

  // 1. Inject `signingConfigs.release`
  let signingConfigsBlock = findBlock(content, 'signingConfigs');
  if (signingConfigsBlock) {
    if (!/\brelease\s*\{/.test(signingConfigsBlock.inner)) {
      const beforeClose = content.slice(0, signingConfigsBlock.closeBrace);
      const lastNewline = beforeClose.lastIndexOf('\n');
      const indent = lastNewline !== -1 ? beforeClose.slice(lastNewline + 1) : '    ';

      const releaseBlock = generateReleaseBlock(`${indent}    `, eol);
      const insertPos = lastNewline !== -1 ? lastNewline + 1 : signingConfigsBlock.closeBrace;
      content = content.slice(0, insertPos) + releaseBlock + eol + indent + content.slice(signingConfigsBlock.closeBrace);
    }
  } else {
    // If signingConfigs block does not exist at all, inject inside android { ... }
    const androidBlock = findBlock(content, 'android');
    if (androidBlock) {
      const buildTypesMatch = /\bbuildTypes\s*\{/.exec(content);
      const insertPos = buildTypesMatch && buildTypesMatch.index > androidBlock.openBrace
        ? buildTypesMatch.index
        : androidBlock.openBrace + 1;
      const indent = '    ';
      const releaseBlock = generateReleaseBlock(`${indent}    `, eol);
      const newSigningConfigs = [
        `${indent}signingConfigs {`,
        `${indent}    debug {`,
        `${indent}        storeFile file('debug.keystore')`,
        `${indent}        storePassword 'android'`,
        `${indent}        keyAlias 'androiddebugkey'`,
        `${indent}        keyPassword 'android'`,
        `${indent}    }`,
        releaseBlock,
        `${indent}}`,
        ``,
      ].join(eol);
      content = content.slice(0, insertPos) + newSigningConfigs + content.slice(insertPos);
    }
  }

  // 2. Modify `buildTypes.release` to use conditional release signing
  const buildTypesBlock = findBlock(content, 'buildTypes');
  if (buildTypesBlock) {
    const releaseBlockInBuildTypes = findBlock(content, 'release', buildTypesBlock.openBrace);
    if (releaseBlockInBuildTypes && releaseBlockInBuildTypes.closeBrace < buildTypesBlock.closeBrace) {
      if (!releaseBlockInBuildTypes.inner.includes('hasReleaseSigning')) {
        const signingConfigMatch = /(^[ \t]*)signingConfig\b.*$/m.exec(releaseBlockInBuildTypes.inner);
        if (signingConfigMatch) {
          const releaseIndent = signingConfigMatch[1];
          const replacement = [
            `${releaseIndent}def hasReleaseSigning = signingConfigs.release.storeFile && signingConfigs.release.storeFile.exists()`,
            `${releaseIndent}signingConfig hasReleaseSigning ? signingConfigs.release : signingConfigs.debug`,
          ].join(eol);
          const matchStartInContent = releaseBlockInBuildTypes.openBrace + 1 + signingConfigMatch.index;
          const matchEndInContent = matchStartInContent + signingConfigMatch[0].length;
          content = content.slice(0, matchStartInContent) + replacement + content.slice(matchEndInContent);
        } else {
          // If no existing signingConfig directive, insert right after release {
          const releaseIndent = '            ';
          const insertion = eol + [
            `${releaseIndent}def hasReleaseSigning = signingConfigs.release.storeFile && signingConfigs.release.storeFile.exists()`,
            `${releaseIndent}signingConfig hasReleaseSigning ? signingConfigs.release : signingConfigs.debug`,
          ].join(eol);
          content = content.slice(0, releaseBlockInBuildTypes.openBrace + 1) + insertion + content.slice(releaseBlockInBuildTypes.openBrace + 1);
        }
      }
    }
  }

  return content;
}

/**
 * Expo Config Plugin to inject Android release signing configuration declaratively.
 *
 * @param {import('@expo/config-types').ExpoConfig} config
 * @returns {import('@expo/config-types').ExpoConfig}
 */
function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = modifyAppBuildGradle(modConfig.modResults.contents);
    return modConfig;
  });
}

withReleaseSigning.modifyAppBuildGradle = modifyAppBuildGradle;

module.exports = withReleaseSigning;
module.exports.default = withReleaseSigning;
module.exports.modifyAppBuildGradle = modifyAppBuildGradle;
