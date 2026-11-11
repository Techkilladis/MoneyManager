/* eslint-disable @typescript-eslint/no-require-imports */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Import functions under test from bump-version.js
const {
  incrementPatch,
  incrementVersionCode,
  readManifests,
  bumpVersion,
} = require('../bump-version');

describe('scripts/bump-version', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-version-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('incrementPatch', () => {
    it('increments standard patch versions correctly', () => {
      expect(incrementPatch('1.0.0')).toBe('1.0.1');
      expect(incrementPatch('1.2.9')).toBe('1.2.10');
      expect(incrementPatch('0.0.1')).toBe('0.0.2');
      expect(incrementPatch('2.10.99')).toBe('2.10.100');
    });

    it('strips leading "v" prefix if present', () => {
      expect(incrementPatch('v1.0.0')).toBe('1.0.1');
      expect(incrementPatch('v2.3.4')).toBe('2.3.5');
    });

    it('handles pre-release or build metadata by bumping patch', () => {
      expect(incrementPatch('1.0.0-beta.1')).toBe('1.0.1');
    });

    it('throws error for invalid semver strings', () => {
      expect(() => incrementPatch('invalid')).toThrow();
      expect(() => incrementPatch('1.0')).toThrow();
      expect(() => incrementPatch('')).toThrow();
      expect(() => incrementPatch(null as unknown as string)).toThrow();
    });
  });

  describe('incrementVersionCode', () => {
    it('increments numeric versionCode', () => {
      expect(incrementVersionCode(1)).toBe(2);
      expect(incrementVersionCode(42)).toBe(43);
    });

    it('increments string versionCode', () => {
      expect(incrementVersionCode('1')).toBe(2);
      expect(incrementVersionCode('99')).toBe(100);
    });

    it('defaults safely when versionCode is missing, invalid or zero', () => {
      expect(incrementVersionCode(undefined)).toBe(1);
      expect(incrementVersionCode(null)).toBe(1);
      expect(incrementVersionCode(0)).toBe(1);
      expect(incrementVersionCode(-1)).toBe(1);
      expect(incrementVersionCode('invalid')).toBe(1);
    });
  });

  describe('readManifests and file modification', () => {
    it('reads and increments manifests, updating app.json, package.json, and package-lock.json', () => {
      const packageJsonContent = {
        name: 'test-app',
        version: '1.0.0',
        private: true,
      };

      const appJsonContent = {
        expo: {
          name: 'Test App',
          version: '1.0.0',
          android: {
            package: 'com.test.app',
            versionCode: 1,
          },
        },
      };

      const packageLockContent = {
        name: 'test-app',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'test-app',
            version: '1.0.0',
          },
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), JSON.stringify(packageLockContent, null, 2) + '\n');

      const result = bumpVersion({ dir: tempDir });

      expect(result).toEqual({
        previousVersion: '1.0.0',
        previousVersionCode: 1,
        version: '1.0.1',
        versionCode: 2,
        tag: 'v1.0.1',
      });

      // Verify files written to disk
      const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
      expect(updatedPackageJson.version).toBe('1.0.1');

      const updatedAppJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'app.json'), 'utf8'));
      expect(updatedAppJson.expo.version).toBe('1.0.1');
      expect(updatedAppJson.expo.android.versionCode).toBe(2);

      const updatedPackageLock = JSON.parse(fs.readFileSync(path.join(tempDir, 'package-lock.json'), 'utf8'));
      expect(updatedPackageLock.version).toBe('1.0.1');
      expect(updatedPackageLock.packages[''].version).toBe('1.0.1');

      // Verify formatting has trailing newline
      const rawPkg = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      expect(rawPkg.endsWith('\n')).toBe(true);
    });

    it('works cleanly when package-lock.json is absent', () => {
      const packageJsonContent = { name: 'test-app', version: '1.2.9' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.2.9', android: { versionCode: 15 } } };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const result = bumpVersion({ dir: tempDir });

      expect(result.version).toBe('1.2.10');
      expect(result.versionCode).toBe(16);
      expect(result.tag).toBe('v1.2.10');

      expect(fs.existsSync(path.join(tempDir, 'package-lock.json'))).toBe(false);
    });

    it('handles app.json where expo.android is not yet defined', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0' } };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const result = bumpVersion({ dir: tempDir });

      expect(result.version).toBe('1.0.1');
      expect(result.versionCode).toBe(1);

      const updatedAppJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'app.json'), 'utf8'));
      expect(updatedAppJson.expo.android.versionCode).toBe(1);
    });

    it('safely handles non-positive or non-integer versionCode in app.json', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0', android: { versionCode: 0 } } };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const manifests = readManifests(tempDir);
      expect(manifests.currentVersionCode).toBeUndefined();

      const result = bumpVersion({ dir: tempDir });
      expect(result.versionCode).toBe(1);
    });

    it('throws when package.json or app.json is missing', () => {
      expect(() => readManifests(tempDir)).toThrow(/Missing required manifest/);
    });
  });

  describe('dryRun behavior', () => {
    it('calculates bumped versions without modifying files on disk', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0', android: { versionCode: 1 } } };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const result = bumpVersion({ dir: tempDir, dryRun: true });

      expect(result).toEqual({
        previousVersion: '1.0.0',
        previousVersionCode: 1,
        version: '1.0.1',
        versionCode: 2,
        tag: 'v1.0.1',
      });

      const unbumpedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
      expect(unbumpedPackageJson.version).toBe('1.0.0');

      const unbumpedAppJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'app.json'), 'utf8'));
      expect(unbumpedAppJson.expo.version).toBe('1.0.0');
      expect(unbumpedAppJson.expo.android.versionCode).toBe(1);
    });
  });

  describe('readOnly / current version extraction', () => {
    it('returns current version and versionCode without bumping or modifying files', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.5' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.5', android: { versionCode: 7 } } };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const result = bumpVersion({ dir: tempDir, readOnly: true });

      expect(result).toEqual({
        previousVersion: '1.0.5',
        previousVersionCode: 7,
        version: '1.0.5',
        versionCode: 7,
        tag: 'v1.0.5',
      });
    });
  });

  describe('GITHUB_OUTPUT handling', () => {
    it('appends version, versionCode, and tag to the specified output file', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0', android: { versionCode: 1 } } };
      const outputFile = path.join(tempDir, 'github_output.txt');

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      bumpVersion({ dir: tempDir, githubOutput: outputFile });

      const outputContent = fs.readFileSync(outputFile, 'utf8');
      expect(outputContent).toContain('version=1.0.1\n');
      expect(outputContent).toContain('version_code=2\n');
      expect(outputContent).toContain('tag=v1.0.1\n');
      expect(outputContent).toContain('js-version=1.0.1\n');
      expect(outputContent).toContain('native-version=2\n');
      expect(outputContent).not.toContain('version-code=');
      expect(outputContent).not.toContain('js=');
      expect(outputContent).not.toContain('native=');
    });
  });

  describe('CLI execution', () => {
    const scriptPath = path.resolve(__dirname, '../bump-version.js');

    it('executes via node CLI and writes manifests', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0', android: { versionCode: 1 } } };
      const outputFile = path.join(tempDir, 'cli_output.txt');

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const stdout = execSync(
        `node "${scriptPath}"`,
        {
          cwd: tempDir,
          env: { ...process.env, GITHUB_OUTPUT: outputFile },
          encoding: 'utf8',
        }
      );

      expect(stdout).toContain('Version bumped: 1.0.0 -> 1.0.1');

      const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
      expect(updatedPackageJson.version).toBe('1.0.1');

      const outputContent = fs.readFileSync(outputFile, 'utf8');
      expect(outputContent).toContain('version=1.0.1\n');
      expect(outputContent).toContain('version_code=2\n');
    });

    it('supports --dry-run in CLI', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0', android: { versionCode: 1 } } };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const stdout = execSync(
        `node "${scriptPath}" --dry-run`,
        { cwd: tempDir, encoding: 'utf8' }
      );

      expect(stdout).toContain('[DRY RUN]');
      const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
      expect(pkg.version).toBe('1.0.0');
    });

    it('supports --current in CLI', () => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0' };
      const appJsonContent = { expo: { name: 'Test App', version: '1.0.0', android: { versionCode: 1 } } };
      const outputFile = path.join(tempDir, 'cli_current.txt');

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJsonContent, null, 2) + '\n');
      fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(appJsonContent, null, 2) + '\n');

      const stdout = execSync(
        `node "${scriptPath}" --current`,
        {
          cwd: tempDir,
          env: { ...process.env, GITHUB_OUTPUT: outputFile },
          encoding: 'utf8',
        }
      );

      expect(stdout).toContain('Current version: 1.0.0');
      const outputContent = fs.readFileSync(outputFile, 'utf8');
      expect(outputContent).toContain('version=1.0.0\n');
      expect(outputContent).toContain('version_code=1\n');
    });
  });
});
