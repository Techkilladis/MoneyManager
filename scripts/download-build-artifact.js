/**
 * scripts/download-build-artifact.js
 *
 * Handles parsing EAS build output, downloading the Android APK artifact,
 * verifying file validity, and producing release metadata & download links.
 * Used in CI/CD native build workflows.
 */

const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');

/**
 * Extracts and parses JSON from raw EAS CLI output.
 * Handles CLI stdout noise preceding or trailing the JSON payload.
 *
 * @param {string|object} rawInput
 * @returns {{
 *   buildId: string,
 *   platform: string,
 *   status: string,
 *   buildUrl: string
 * }}
 */
function parseBuildOutput(rawInput) {
  if (!rawInput || (typeof rawInput === 'string' && rawInput.trim() === '')) {
    throw new Error('EAS build output is empty');
  }

  let parsed;
  if (typeof rawInput === 'object') {
    parsed = rawInput;
  } else {
    const text = String(rawInput).trim();
    try {
      parsed = JSON.parse(text);
    } catch {
      // Find outermost JSON array [...] or object {...}
      const arrayStart = text.indexOf('[');
      const arrayEnd = text.lastIndexOf(']');
      const objStart = text.indexOf('{');
      const objEnd = text.lastIndexOf('}');

      let jsonCandidate = null;
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        jsonCandidate = text.substring(arrayStart, arrayEnd + 1);
      } else if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
        jsonCandidate = text.substring(objStart, objEnd + 1);
      }

      if (jsonCandidate) {
        try {
          parsed = JSON.parse(jsonCandidate);
        } catch (err) {
          throw new Error(`Failed to parse JSON from EAS build output: ${err.message}`);
        }
      } else {
        throw new Error('Failed to parse JSON from EAS build output: No valid JSON found');
      }
    }
  }

  const builds = Array.isArray(parsed) ? parsed : [parsed];
  if (builds.length === 0) {
    throw new Error('EAS build output contains no builds');
  }

  // Look for Android platform first, otherwise first available build
  const androidBuild = builds.find(b => (b.platform || '').toUpperCase() === 'ANDROID') || builds[0];

  if (!androidBuild) {
    throw new Error('No build found in EAS output');
  }

  const status = (androidBuild.status || '').toLowerCase();
  if (status === 'errored' || status === 'canceled') {
    const errorMsg = androidBuild.error?.message || androidBuild.message || 'Build was canceled or errored';
    throw new Error(`EAS Build did not succeed (status: ${status}): ${errorMsg}`);
  }

  const artifacts = androidBuild.artifacts || {};
  const buildUrl = artifacts.buildUrl || artifacts.applicationArchiveUrl || artifacts.appBundleUrl;

  if (!buildUrl || typeof buildUrl !== 'string' || buildUrl.trim() === '') {
    throw new Error(`No artifact URL found in EAS build output for build ${androidBuild.id || 'unknown'}`);
  }

  return {
    buildId: androidBuild.id || '',
    platform: (androidBuild.platform || 'ANDROID').toUpperCase(),
    status: androidBuild.status || 'finished',
    buildUrl: buildUrl.trim(),
  };
}

/**
 * Verifies that a downloaded APK file exists, is non-empty, and has an .apk extension.
 *
 * @param {string} filePath
 * @returns {{ valid: boolean, size: number, path: string }}
 */
function verifyApkFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error(`Invalid APK file path: ${filePath}`);
  }

  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`APK file does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    throw new Error(`APK path is a directory, expected file: ${resolved}`);
  }

  if (stat.size === 0) {
    throw new Error(`APK file is empty (0 bytes): ${resolved}`);
  }

  if (!resolved.toLowerCase().endsWith('.apk')) {
    throw new Error(`APK file must end with .apk extension: ${resolved}`);
  }

  return {
    valid: true,
    size: stat.size,
    path: resolved,
  };
}

/**
 * Generates direct download URL for a GitHub Release asset.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag
 * @param {string} filename
 * @returns {string}
 */
function getDirectDownloadUrl(owner, repo, tag, filename) {
  const cleanOwner = (owner || '').replace(/^\/+|\/+$/g, '');
  const cleanRepo = (repo || '').replace(/^\/+|\/+$/g, '');
  const cleanTag = (tag || '').replace(/^\/+|\/+$/g, '');
  const cleanFilename = (filename || '').replace(/^\/+|\/+$/g, '');

  return `https://github.com/${cleanOwner}/${cleanRepo}/releases/download/${cleanTag}/${cleanFilename}`;
}

/**
 * Generates markdown comment for merged pull requests with release metadata and direct APK link.
 *
 * @param {{
 *   tag: string,
 *   versionCode: number|string,
 *   user: string,
 *   commitSha?: string,
 *   directDownloadUrl: string,
 *   releaseUrl?: string,
 *   apkFileName?: string,
 *   fileSizeBytes?: number
 * }} options
 * @returns {string}
 */
function formatReleaseComment(options) {
  const tag = options.tag || '';
  const versionCode = options.versionCode || '';
  const user = options.user || 'developer';
  const directDownloadUrl = options.directDownloadUrl;
  const releaseUrl = options.releaseUrl || directDownloadUrl;
  const fileName = options.apkFileName || `MoneyManager-${tag}.apk`;

  let sizeStr = '';
  if (options.fileSizeBytes && options.fileSizeBytes > 0) {
    const mb = (options.fileSizeBytes / (1024 * 1024)).toFixed(1);
    sizeStr = ` (${mb} MB)`;
  }

  return [
    `## Native APK Published 🤖`,
    ``,
    `A full native Android build has completed and the APK is attached to a GitHub Release.`,
    ``,
    `> **Version**: ${tag} (versionCode: ${versionCode})`,
    `> **Triggered by**: @${user}`,
    options.commitSha ? `> **Commit**: \`${options.commitSha.substring(0, 7)}\`` : '',
    ``,
    `### 📲 Download`,
    `- **[Direct Download APK (${fileName})](${directDownloadUrl})**${sizeStr}`,
    `- [View GitHub Release](${releaseUrl})`,
    ``,
    `Share the direct download link with friends — tapping the link immediately starts the APK download in the browser. Installing it performs an in-place upgrade while preserving all existing data.`,
    ``,
    `---`,
    `_Automated by CI/CD pipeline_`,
  ]
    .filter(line => line !== null && line !== undefined)
    .join('\n');
}

/**
 * Downloads artifact from URL into destination path and verifies it.
 *
 * @param {string} url
 * @param {string} destinationPath
 * @param {{ fetchFn?: typeof fetch }} [options]
 * @returns {Promise<string>}
 */
async function downloadArtifact(url, destinationPath, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  if (!fetchFn) {
    throw new Error('fetch is not available in current environment');
  }

  const resolvedDest = path.resolve(destinationPath);
  const dir = path.dirname(resolvedDest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const response = await fetchFn(url, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download artifact: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(resolvedDest, Buffer.from(arrayBuffer));

  verifyApkFile(resolvedDest);
  return resolvedDest;
}

/**
 * Appends key-value pairs to GitHub Actions step output file ($GITHUB_OUTPUT).
 *
 * @param {Record<string, string|number>} outputs
 */
function writeGitHubOutputs(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.appendFileSync(outputPath, `${lines}\n`, 'utf8');
}

/**
 * CLI Entrypoint
 */
async function main() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let outputFile = null;
  let verifyOnly = null;
  let tag = process.env.RELEASE_TAG || '';
  let owner = process.env.GITHUB_REPOSITORY_OWNER || 'Techkilladis';
  let repo = 'MoneyManager';
  if (process.env.GITHUB_REPOSITORY) {
    const parts = process.env.GITHUB_REPOSITORY.split('/');
    if (parts.length === 2) {
      owner = parts[0];
      repo = parts[1];
    }
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputFile = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[++i];
    } else if (args[i] === '--verify' && args[i + 1]) {
      verifyOnly = args[++i];
    } else if (args[i] === '--tag' && args[i + 1]) {
      tag = args[++i];
    } else if (args[i] === '--owner' && args[i + 1]) {
      owner = args[++i];
    } else if (args[i] === '--repo' && args[i + 1]) {
      repo = args[++i];
    }
  }

  if (verifyOnly) {
    const verified = verifyApkFile(verifyOnly);
    console.log(`Verified APK: ${verified.path} (${verified.size} bytes)`);
    writeGitHubOutputs({
      apk_path: verified.path,
      apk_size: verified.size,
      apk_filename: path.basename(verified.path),
    });
    return;
  }

  if (!inputFile) {
    console.error('Usage: node scripts/download-build-artifact.js --input <build-output.json> [--output <path.apk>] [--tag <vX.Y.Z>]');
    process.exit(1);
  }

  const rawJson = fs.readFileSync(path.resolve(inputFile), 'utf8');
  const buildInfo = parseBuildOutput(rawJson);
  console.log(`Extracted artifact URL: ${buildInfo.buildUrl}`);
  console.log(`Build ID: ${buildInfo.buildId}, Status: ${buildInfo.status}`);

  const defaultFileName = tag ? `MoneyManager-${tag}.apk` : 'MoneyManager.apk';
  const targetOutput = outputFile || path.join(process.cwd(), defaultFileName);

  console.log(`Downloading APK artifact to ${targetOutput}...`);
  await downloadArtifact(buildInfo.buildUrl, targetOutput);

  const verified = verifyApkFile(targetOutput);
  const apkFileName = path.basename(verified.path);
  const directDownloadUrl = getDirectDownloadUrl(owner, repo, tag, apkFileName);

  console.log(`APK successfully downloaded and verified:`);
  console.log(`  Path: ${verified.path}`);
  console.log(`  Size: ${verified.size} bytes`);
  console.log(`  Direct download URL: ${directDownloadUrl}`);

  writeGitHubOutputs({
    artifact_url: buildInfo.buildUrl,
    apk_path: verified.path,
    apk_filename: apkFileName,
    apk_size: verified.size,
    direct_download_url: directDownloadUrl,
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseBuildOutput,
  verifyApkFile,
  getDirectDownloadUrl,
  formatReleaseComment,
  downloadArtifact,
  writeGitHubOutputs,
};
