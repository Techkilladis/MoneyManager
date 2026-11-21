/**
 * scripts/validate-keystore-secrets.js
 *
 * Validates required GitHub repository secrets for Android release signing,
 * provides step-by-step diagnostic instructions for exporting from EAS if missing,
 * decodes the release keystore into an ephemeral file path, and handles cleanup.
 */

const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');

const REQUIRED_SECRETS = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

const DEFAULT_KEYSTORE_PATH = 'android/app/release.keystore';

/**
 * Formats actionable instructions for missing secrets, detailing EAS credential export
 * and base64 encoding procedures.
 *
 * @param {string[]} missing
 * @returns {string}
 */
function formatEasInstructions(missing) {
  const missingList = Array.isArray(missing) && missing.length > 0 ? missing.join(', ') : REQUIRED_SECRETS.join(', ');

  return [
    '================================================================================',
    `[ERROR] Android Release Signing Secrets Missing: ${missingList}`,
    '================================================================================',
    'To compile production release APKs on GitHub Actions runners, configure repository',
    'secrets in: Settings -> Secrets and variables -> Actions',
    '',
    'Required Secrets:',
    '  - ANDROID_KEYSTORE_BASE64  : Base64-encoded release keystore',
    '  - ANDROID_KEYSTORE_PASSWORD: Password for the release keystore',
    '  - ANDROID_KEY_ALIAS        : Keystore key alias',
    '  - ANDROID_KEY_PASSWORD     : Password for the key alias',
    '',
    'Step-by-step export from EAS:',
    '  1. Run: npx eas-cli@latest credentials',
    '  2. Select Android -> production -> Keystore: Download or view credentials',
    '  3. Encode the downloaded keystore to base64:',
    '     Linux/macOS: base64 -w 0 release.keystore > keystore_base64.txt',
    '     PowerShell:  [Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore"))',
    '  4. Save as GitHub Repository Secrets.',
    '================================================================================',
  ].join('\n');
}

/**
 * Validates that all required release signing secrets are present and non-empty.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ valid: boolean; missing: string[]; errorMessage?: string }}
 */
function validateSecrets(env = process.env) {
  const safeEnv = env || {};
  const missing = [];

  for (const secret of REQUIRED_SECRETS) {
    const val = safeEnv[secret];
    if (typeof val !== 'string' || val.trim().length === 0) {
      missing.push(secret);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      errorMessage: formatEasInstructions(missing),
    };
  }

  return {
    valid: true,
    missing: [],
  };
}

/**
 * Decodes base64 keystore content and writes raw binary to targetPath.
 * Ensures strict file permissions on Unix-like runners.
 *
 * @param {string} base64Content
 * @param {string} targetPath
 * @returns {{ path: string; size: number }}
 */
function provisionKeystore(base64Content, targetPath) {
  if (typeof base64Content !== 'string' || base64Content.trim().length === 0) {
    throw new Error('Base64 content is required to provision keystore');
  }

  if (typeof targetPath !== 'string' || targetPath.trim().length === 0) {
    throw new Error('Target path is required to provision keystore');
  }

  const cleanBase64 = base64Content.replace(/\s+/g, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length === 0) {
    throw new Error('Base64 decoded buffer is empty');
  }

  const resolvedPath = path.resolve(targetPath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, buffer);

  const stat = fs.statSync(resolvedPath);
  if (stat.size !== buffer.length) {
    throw new Error(
      `Keystore provisioning validation failed: expected ${buffer.length} bytes, wrote ${stat.size} bytes`
    );
  }

  try {
    fs.chmodSync(resolvedPath, 0o600);
  } catch {
    // fs.chmodSync may fail or be a no-op on Windows filesystems; ignore
  }

  return {
    path: resolvedPath,
    size: buffer.length,
  };
}

/**
 * Removes the ephemeral keystore file if it exists.
 *
 * @param {string} targetPath
 * @returns {boolean} True if file existed and was removed, false otherwise
 */
function cleanupKeystore(targetPath) {
  if (typeof targetPath !== 'string' || targetPath.trim().length === 0) {
    return false;
  }

  const resolvedPath = path.resolve(targetPath);
  if (fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
    return true;
  }

  return false;
}

/**
 * Writes key-value outputs to $GITHUB_OUTPUT and $GITHUB_ENV if defined.
 *
 * @param {Record<string, string | number | boolean>} outputs
 */
function writeGitHubOutputs(outputs) {
  const entries = Object.entries(outputs);
  if (entries.length === 0) return;

  const content = entries.map(([k, v]) => `${k}=${v}\n`).join('');

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput && githubOutput !== 'undefined') {
    try {
      fs.appendFileSync(githubOutput, content, 'utf8');
    } catch (err) {
      console.warn(`Warning: Could not write to GITHUB_OUTPUT (${githubOutput}): ${err.message}`);
    }
  }

  const githubEnv = process.env.GITHUB_ENV;
  if (githubEnv && githubEnv !== 'undefined') {
    try {
      fs.appendFileSync(githubEnv, content, 'utf8');
    } catch (err) {
      console.warn(`Warning: Could not write to GITHUB_ENV (${githubEnv}): ${err.message}`);
    }
  }
}

/**
 * Parses CLI arguments.
 *
 * @param {string[]} argv
 * @returns {{ cleanup: boolean; cleanupPath?: string; output?: string }}
 */
function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    cleanup: false,
    cleanupPath: undefined,
    output: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--cleanup') {
      options.cleanup = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options.cleanupPath = next;
        i++;
      }
    } else if (arg === '--output' || arg === '-o') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options.output = next;
        i++;
      }
    }
  }

  return options;
}

/**
 * CLI execution entrypoint.
 */
function main() {
  const options = parseArgs();

  if (options.cleanup) {
    const cleanupTarget =
      options.cleanupPath || options.output || process.env.ANDROID_KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;
    const removed = cleanupKeystore(cleanupTarget);
    if (removed) {
      console.log(`Keystore successfully cleaned up: ${cleanupTarget}`);
    } else {
      console.log(`No keystore file to clean up at: ${cleanupTarget}`);
    }
    process.exit(0);
  }

  const validation = validateSecrets(process.env);
  if (!validation.valid) {
    console.error(validation.errorMessage);
    process.exit(1);
  }

  const targetPath = options.output || process.env.ANDROID_KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;
  const provisioned = provisionKeystore(process.env.ANDROID_KEYSTORE_BASE64, targetPath);

  console.log(`Keystore successfully provisioned:`);
  console.log(`  Path: ${provisioned.path}`);
  console.log(`  Size: ${provisioned.size} bytes`);

  writeGitHubOutputs({
    keystore_path: provisioned.path,
    keystore_ready: 'true',
  });

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_SECRETS,
  DEFAULT_KEYSTORE_PATH,
  formatEasInstructions,
  validateSecrets,
  provisionKeystore,
  cleanupKeystore,
  writeGitHubOutputs,
  parseArgs,
};
