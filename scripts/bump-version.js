/**
 * scripts/bump-version.js
 *
 * Automated semantic patch version and Android versionCode bumper.
 * Used in CI/CD pipeline and release workflows.
 *
 * Features:
 * - Increment semantic patch version in package.json, app.json, and package-lock.json
 * - Increment Android versionCode (+1) in app.json (under expo.android.versionCode)
 * - Safe defaulting for missing, non-numeric, or <= 0 versionCodes
 * - Support dry-run mode (--dry-run)
 * - Support read-only / current mode (--current, --read-only)
 * - Support $GITHUB_OUTPUT appending for GitHub Actions step integration
 * - Preserves 2-space indentation and trailing newlines
 */

const fs = require('fs');
const path = require('path');

/**
 * Increment semver patch version.
 * e.g. "1.0.0" -> "1.0.1", "1.2.9" -> "1.2.10", "v1.0.0" -> "1.0.1"
 *
 * @param {string} version
 * @returns {string}
 */
function incrementPatch(version) {
  if (!version || typeof version !== 'string') {
    throw new Error(`Invalid version: ${version}`);
  }
  const clean = version.trim().replace(/^v/, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Version does not follow semver format (X.Y.Z): ${version}`);
  }
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10) + 1;
  return `${major}.${minor}.${patch}`;
}

/**
 * Increment Android versionCode.
 * e.g. 1 -> 2, "1" -> 2, undefined/null/0/invalid -> 1
 *
 * @param {number|string|undefined|null} currentCode
 * @returns {number}
 */
function incrementVersionCode(currentCode) {
  if (currentCode === undefined || currentCode === null || currentCode === '') {
    return 1;
  }
  const parsed = Number(currentCode);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed + 1;
}

/**
 * Read and validate project manifests.
 *
 * @param {string} projectDir
 * @returns {{
 *   appJsonPath: string,
 *   packageJsonPath: string,
 *   packageLockJsonPath: string,
 *   appJson: any,
 *   packageJson: any,
 *   packageLockJson: any | null,
 *   currentVersion: string,
 *   currentVersionCode: number | undefined
 * }}
 */
function readManifests(projectDir = process.cwd()) {
  const packageJsonPath = path.resolve(projectDir, 'package.json');
  const appJsonPath = path.resolve(projectDir, 'app.json');
  const packageLockJsonPath = path.resolve(projectDir, 'package-lock.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Missing required manifest: ${packageJsonPath}`);
  }
  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`Missing required manifest: ${appJsonPath}`);
  }

  let packageJson;
  let appJson;
  let packageLockJson = null;

  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse ${packageJsonPath}: ${err.message}`);
  }

  try {
    appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse ${appJsonPath}: ${err.message}`);
  }

  if (fs.existsSync(packageLockJsonPath)) {
    try {
      packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse ${packageLockJsonPath}: ${err.message}`);
    }
  }

  const currentVersion =
    packageJson.version ||
    (appJson.expo && appJson.expo.version) ||
    appJson.version ||
    '1.0.0';

  const rawVersionCode =
    appJson.expo && appJson.expo.android && appJson.expo.android.versionCode !== undefined
      ? appJson.expo.android.versionCode
      : appJson.android && appJson.android.versionCode !== undefined
      ? appJson.android.versionCode
      : undefined;

  const currentVersionCode =
    rawVersionCode !== undefined && Number.isInteger(Number(rawVersionCode)) && Number(rawVersionCode) > 0
      ? Number(rawVersionCode)
      : undefined;

  return {
    appJsonPath,
    packageJsonPath,
    packageLockJsonPath,
    appJson,
    packageJson,
    packageLockJson,
    currentVersion,
    currentVersionCode,
  };
}

/**
 * Bump or extract versions and optionally write to disk & GitHub Actions output.
 *
 * @param {object} options
 * @param {string} [options.dir]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.readOnly]
 * @param {string} [options.githubOutput]
 * @returns {{
 *   previousVersion: string,
 *   previousVersionCode: number | undefined,
 *   version: string,
 *   versionCode: number,
 *   tag: string
 * }}
 */
function bumpVersion(options = {}) {
  const dir = options.dir || process.cwd();
  const dryRun = Boolean(options.dryRun);
  const readOnly = Boolean(options.readOnly || options.current);
  const githubOutput = options.githubOutput || process.env.GITHUB_OUTPUT;

  const manifests = readManifests(dir);
  const {
    appJsonPath,
    packageJsonPath,
    packageLockJsonPath,
    appJson,
    packageJson,
    packageLockJson,
    currentVersion,
    currentVersionCode,
  } = manifests;

  let newVersion;
  let newVersionCode;

  if (readOnly) {
    newVersion = currentVersion;
    newVersionCode = currentVersionCode !== undefined ? currentVersionCode : 1;
  } else {
    newVersion = incrementPatch(currentVersion);
    newVersionCode = incrementVersionCode(currentVersionCode);
  }

  const tag = `v${newVersion}`;

  if (!dryRun && !readOnly) {
    // 1. Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

    // 2. Update app.json (expo.version and expo.android.versionCode)
    if (!appJson.expo) {
      appJson.expo = {};
    }
    appJson.expo.version = newVersion;
    if (!appJson.expo.android) {
      appJson.expo.android = {};
    }
    appJson.expo.android.versionCode = newVersionCode;
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');

    // 3. Update package-lock.json if present
    if (packageLockJson) {
      packageLockJson.version = newVersion;
      if (packageLockJson.packages && packageLockJson.packages['']) {
        packageLockJson.packages[''].version = newVersion;
      }
      fs.writeFileSync(packageLockJsonPath, JSON.stringify(packageLockJson, null, 2) + '\n', 'utf8');
    }
  }

  // Write outputs to GitHub Actions output file if specified
  if (githubOutput) {
    const lines = [
      `version=${newVersion}`,
      `version_code=${newVersionCode}`,
      `tag=${tag}`,
      `js-version=${newVersion}`,
      `native-version=${newVersionCode}`,
      '',
    ].join('\n');
    fs.appendFileSync(githubOutput, lines, 'utf8');
  }

  return {
    previousVersion: currentVersion,
    previousVersionCode: currentVersionCode,
    version: newVersion,
    versionCode: newVersionCode,
    tag,
  };
}

// CLI handler
function runCli() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const readOnly = args.includes('--current') || args.includes('--read-only');

  try {
    const result = bumpVersion({
      dryRun,
      readOnly,
    });

    if (readOnly) {
      console.log(`Current version: ${result.version} (versionCode: ${result.versionCode}, tag: ${result.tag})`);
    } else if (dryRun) {
      console.log(
        `[DRY RUN] Would bump version: ${result.previousVersion} -> ${result.version} ` +
          `(versionCode: ${result.previousVersionCode} -> ${result.versionCode}, tag: ${result.tag})`
      );
    } else {
      console.log(
        `Version bumped: ${result.previousVersion} -> ${result.version} ` +
          `(versionCode: ${result.previousVersionCode} -> ${result.versionCode}, tag: ${result.tag})`
      );
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  incrementPatch,
  incrementVersionCode,
  readManifests,
  bumpVersion,
};
