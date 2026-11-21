import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Seam under test: scripts/download-build-artifact.js
// We require the commonjs module under test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  parseBuildOutput,
  verifyApkFile,
  getDirectDownloadUrl,
  formatReleaseComment,
  downloadArtifact,
  stageLocalApk,
} = require('../download-build-artifact');

describe('download-build-artifact', () => {
  const tmpDir = path.resolve(__dirname, '../../test-tmp-apk');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    } catch {
      // Ignore transient file lock on Windows teardown
    }
  });

  describe('parseBuildOutput', () => {
    it('parses JSON array format from EAS CLI with buildUrl', () => {
      const mockEasOutput = JSON.stringify([
        {
          id: 'build-id-123',
          platform: 'ANDROID',
          status: 'finished',
          profile: 'production',
          artifacts: {
            buildUrl: 'https://exp-artifacts.s3.amazonaws.com/builds/app-release-1.0.2.apk',
          },
        },
      ]);

      const result = parseBuildOutput(mockEasOutput);
      expect(result).toEqual({
        buildId: 'build-id-123',
        platform: 'ANDROID',
        status: 'finished',
        buildUrl: 'https://exp-artifacts.s3.amazonaws.com/builds/app-release-1.0.2.apk',
      });
    });

    it('parses single object format with applicationArchiveUrl', () => {
      const mockEasOutput = JSON.stringify({
        id: 'build-id-456',
        platform: 'ANDROID',
        status: 'finished',
        profile: 'production',
        artifacts: {
          applicationArchiveUrl: 'https://exp-artifacts.s3.amazonaws.com/builds/app-prod.apk',
        },
      });

      const result = parseBuildOutput(mockEasOutput);
      expect(result).toEqual({
        buildId: 'build-id-456',
        platform: 'ANDROID',
        status: 'finished',
        buildUrl: 'https://exp-artifacts.s3.amazonaws.com/builds/app-prod.apk',
      });
    });

    it('extracts ANDROID build when multiple platforms are present in array', () => {
      const mockEasOutput = JSON.stringify([
        {
          id: 'ios-build-1',
          platform: 'IOS',
          status: 'finished',
          artifacts: {
            buildUrl: 'https://exp-artifacts.s3.amazonaws.com/builds/app.ipa',
          },
        },
        {
          id: 'android-build-2',
          platform: 'ANDROID',
          status: 'finished',
          artifacts: {
            buildUrl: 'https://exp-artifacts.s3.amazonaws.com/builds/app.apk',
          },
        },
      ]);

      const result = parseBuildOutput(mockEasOutput);
      expect(result.platform).toBe('ANDROID');
      expect(result.buildId).toBe('android-build-2');
      expect(result.buildUrl).toBe('https://exp-artifacts.s3.amazonaws.com/builds/app.apk');
    });

    it('handles noisy CLI logs preceding or following the JSON payload', () => {
      const noisyOutput = [
        'EAS Build: initiating cloud build on production profile...',
        'Waiting for build to finish...',
        '[',
        '  {',
        '    "id": "build-noisy-789",',
        '    "platform": "ANDROID",',
        '    "status": "finished",',
        '    "artifacts": {',
        '      "buildUrl": "https://exp-artifacts.s3.amazonaws.com/noisy.apk"',
        '    }',
        '  }',
        ']',
        'Done in 345s.',
      ].join('\n');

      const result = parseBuildOutput(noisyOutput);
      expect(result.buildUrl).toBe('https://exp-artifacts.s3.amazonaws.com/noisy.apk');
      expect(result.buildId).toBe('build-noisy-789');
    });

    it('throws when build status is errored', () => {
      const failedOutput = JSON.stringify([
        {
          id: 'build-err',
          platform: 'ANDROID',
          status: 'errored',
          error: { message: 'Gradle build failed' },
        },
      ]);

      expect(() => parseBuildOutput(failedOutput)).toThrow(/Build did not succeed|errored/i);
    });

    it('throws when no artifact URL is present', () => {
      const missingArtifact = JSON.stringify([
        {
          id: 'build-no-art',
          platform: 'ANDROID',
          status: 'finished',
          artifacts: {},
        },
      ]);

      expect(() => parseBuildOutput(missingArtifact)).toThrow(/No artifact URL found/i);
    });

    it('throws when input is empty or invalid JSON', () => {
      expect(() => parseBuildOutput('')).toThrow(/empty/i);
      expect(() => parseBuildOutput('Invalid non-json output')).toThrow(/Failed to parse JSON/i);
    });
  });

  describe('verifyApkFile', () => {
    it('verifies valid, non-empty .apk file successfully', () => {
      const validApk = path.join(tmpDir, 'valid-test.apk');
      fs.writeFileSync(validApk, Buffer.from('FAKE-APK-BINARY-DATA-NON-EMPTY'));

      const result = verifyApkFile(validApk);
      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(result.path).toBe(validApk);
    });

    it('throws when file does not exist', () => {
      const missingPath = path.join(tmpDir, 'non-existent.apk');
      expect(() => verifyApkFile(missingPath)).toThrow(/does not exist/i);
    });

    it('throws when file exists but is 0 bytes', () => {
      const emptyApk = path.join(tmpDir, 'empty.apk');
      fs.writeFileSync(emptyApk, Buffer.alloc(0));

      expect(() => verifyApkFile(emptyApk)).toThrow(/empty/i);
    });

    it('throws when file is not an .apk file', () => {
      const notApk = path.join(tmpDir, 'archive.zip');
      fs.writeFileSync(notApk, Buffer.from('some data'));

      expect(() => verifyApkFile(notApk)).toThrow(/must end with \.apk/i);
    });
  });

  describe('getDirectDownloadUrl', () => {
    it('generates the exact GitHub release direct download URL', () => {
      const url = getDirectDownloadUrl(
        'Techkilladis',
        'MoneyManager',
        'v1.0.2',
        'MoneyManager-v1.0.2.apk'
      );

      expect(url).toBe(
        'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.2/MoneyManager-v1.0.2.apk'
      );
    });

    it('handles tags without leading v or extra slashes', () => {
      const url = getDirectDownloadUrl(
        'Techkilladis/',
        '/MoneyManager',
        '1.0.2',
        'MoneyManager-1.0.2.apk'
      );

      expect(url).toBe(
        'https://github.com/Techkilladis/MoneyManager/releases/download/1.0.2/MoneyManager-1.0.2.apk'
      );
    });
  });

  describe('formatReleaseComment', () => {
    it('generates PR comment with release metadata and direct APK download link', () => {
      const comment = formatReleaseComment({
        tag: 'v1.0.2',
        versionCode: 15,
        user: 'Techkilladis',
        commitSha: 'abcdef1234567890',
        directDownloadUrl:
          'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.2/MoneyManager-v1.0.2.apk',
        releaseUrl: 'https://github.com/Techkilladis/MoneyManager/releases/tag/v1.0.2',
        apkFileName: 'MoneyManager-v1.0.2.apk',
        fileSizeBytes: 45000000,
      });

      expect(comment).toContain('Native APK Published');
      expect(comment).toContain('v1.0.2');
      expect(comment).toContain('15');
      expect(comment).toContain('@Techkilladis');
      expect(comment).toContain(
        'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.2/MoneyManager-v1.0.2.apk'
      );
      expect(comment).toContain('Direct Download APK');
      expect(comment).toContain('https://github.com/Techkilladis/MoneyManager/releases/tag/v1.0.2');
    });
  });

  describe('downloadArtifact', () => {
    it('downloads artifact from URL to destination path using fetch', async () => {
      const destPath = path.join(tmpDir, 'downloaded.apk');
      const fakeData = 'PK\x03\x04FAKE-APK-CONTENT-STREAM';

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from(fakeData),
      });

      const downloadedResult = await downloadArtifact(
        'https://fake-cdn.exp.host/app.apk',
        destPath,
        { fetchFn: mockFetch as any }
      );

      expect(downloadedResult.path).toBe(destPath);
      expect(downloadedResult.valid).toBe(true);
      expect(downloadedResult.size).toBeGreaterThan(0);
      expect(fs.existsSync(destPath)).toBe(true);
      expect(fs.readFileSync(destPath, 'utf8')).toBe(fakeData);
    });

    it('throws when download returns non-200 status', async () => {
      const destPath = path.join(tmpDir, 'fail.apk');

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        downloadArtifact('https://fake-cdn.exp.host/not-found.apk', destPath, {
          fetchFn: mockFetch as any,
        })
      ).rejects.toThrow(/HTTP 404/i);
    });
  });

  describe('ci-cd.yml workflow verification for native-build', () => {
    const workflowPath = path.resolve(__dirname, '../../.github/workflows/ci-cd.yml');
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    const nativeBuildContent = workflowContent.slice(workflowContent.indexOf('native-build:'));
    const otaUpdateContent = workflowContent.slice(
      workflowContent.indexOf('ota-update:'),
      workflowContent.indexOf('native-build:')
    );

    it('has removed the non-functional /tmp daily build cap check', () => {
      expect(workflowContent).not.toContain('/tmp/eas-native-build-cap');
      expect(workflowContent).not.toContain('cap-check');
      expect(workflowContent).not.toContain('Native Build Skipped (Daily Cap Reached)');
    });

    it('does not contain eas build --platform android or eas login in native-build', () => {
      expect(nativeBuildContent).not.toMatch(/eas.*build.*--platform\s+android/);
      expect(nativeBuildContent).not.toMatch(/name:\s*EAS login/i);
      expect(nativeBuildContent).not.toContain('eas login');
      expect(nativeBuildContent).not.toContain('EAS_ACCESS_TOKEN');
    });

    it('configures JDK 17 with actions/setup-java@v4 and distribution temurin', () => {
      expect(nativeBuildContent).toContain('actions/setup-java@v4');
      expect(nativeBuildContent).toMatch(/distribution:\s*['"]?temurin['"]?/);
      expect(nativeBuildContent).toMatch(/java-version:\s*['"]?17['"]?/);
    });

    it('caches Gradle using gradle/actions/setup-gradle@v4', () => {
      expect(nativeBuildContent).toContain('gradle/actions/setup-gradle@v4');
    });

    it('validates keystore secrets via node scripts/validate-keystore-secrets.js', () => {
      expect(nativeBuildContent).toMatch(/node\s+scripts\/validate-keystore-secrets\.js/);
      expect(nativeBuildContent).toContain('ANDROID_KEYSTORE_BASE64:');
      expect(nativeBuildContent).toContain('ANDROID_KEYSTORE_PASSWORD:');
      expect(nativeBuildContent).toContain('ANDROID_KEY_ALIAS:');
      expect(nativeBuildContent).toContain('ANDROID_KEY_PASSWORD:');
    });

    it('invokes Continuous Native Generation via npx expo prebuild --platform android --clean', () => {
      expect(nativeBuildContent).toMatch(/npx\s+expo\s+prebuild\s+--platform\s+android\s+--clean/);
    });

    it('ensures Expo Prebuild runs before Validate Keystore Secrets so --clean does not wipe the provisioned keystore', () => {
      const prebuildIndex = nativeBuildContent.indexOf('expo prebuild');
      const validateIndex = nativeBuildContent.indexOf('validate-keystore-secrets.js');
      const assembleIndex = nativeBuildContent.indexOf('assembleRelease');
      expect(prebuildIndex).toBeGreaterThan(-1);
      expect(validateIndex).toBeGreaterThan(prebuildIndex);
      expect(assembleIndex).toBeGreaterThan(validateIndex);
    });

    it('assembles release APK via Gradle: ./gradlew assembleRelease --no-daemon inside android/', () => {
      expect(nativeBuildContent).toMatch(/\.\/gradlew\s+assembleRelease\s+--no-daemon/);
      expect(nativeBuildContent).toMatch(/cd\s+android/);
      expect(nativeBuildContent).toContain('ANDROID_KEYSTORE_PATH:');
      expect(nativeBuildContent).toContain('ANDROID_KEYSTORE_PATH: ${{ steps.validate-keystore.outputs.keystore_path }}');
    });

    it('stages & verifies APK with node scripts/download-build-artifact.js --local-apk', () => {
      expect(nativeBuildContent).toMatch(/node\s+scripts\/download-build-artifact\.js/);
      expect(nativeBuildContent).toMatch(/--local-apk\s+android\/app\/build\/outputs\/apk\/release\/app-release\.apk/);
      expect(nativeBuildContent).toMatch(/--tag\s+["']?\$\{\{\s*needs\.detect-changes\.outputs\.tag\s*\}\}["']?/);
      expect(nativeBuildContent).toMatch(/--output\s+["']?\$\{\{\s*github\.workspace\s*\}\}\/MoneyManager-\$\{\{\s*needs\.detect-changes\.outputs\.tag\s*\}\}\.apk["']?/);
    });

    it('cleans up ephemeral keystore in an if: always() step', () => {
      expect(nativeBuildContent).toMatch(/node\s+scripts\/validate-keystore-secrets\.js\s+--cleanup\s+android\/app\/release\.keystore/);
      expect(nativeBuildContent).toMatch(/if:\s*always\(\)/);
    });

    it('uses steps.stage-apk.outputs.apk_path for upload-artifact and action-gh-release', () => {
      expect(nativeBuildContent).toContain('steps.stage-apk.outputs.apk_path');
      expect(nativeBuildContent).not.toContain('steps.download-apk.outputs.apk_path');
      expect(nativeBuildContent).toMatch(/actions\/upload-artifact@v4/);
      expect(nativeBuildContent).toMatch(/softprops\/action-gh-release@v2/);
    });

    it('uses steps.stage-apk outputs in PR comment script', () => {
      expect(nativeBuildContent).toContain('steps.stage-apk.outputs.apk_filename');
      expect(nativeBuildContent).toContain('steps.stage-apk.outputs.apk_size');
      expect(nativeBuildContent).toContain('steps.stage-apk.outputs.direct_download_url');
    });

    it('leaves the ota-update job untouched, still containing eas update', () => {
      expect(otaUpdateContent).toMatch(/eas(-cli@latest)?\s+update/);
      expect(otaUpdateContent).toContain('EAS_ACCESS_TOKEN');
    });
  });

  describe('stageLocalApk', () => {
    const stageSrcDir = path.join(tmpDir, 'stage-src');
    const stageDestDir = path.join(tmpDir, 'stage-dest');

    beforeEach(() => {
      if (!fs.existsSync(stageSrcDir)) {
        fs.mkdirSync(stageSrcDir, { recursive: true });
      }
      if (!fs.existsSync(stageDestDir)) {
        fs.mkdirSync(stageDestDir, { recursive: true });
      }
    });

    afterEach(() => {
      delete process.env.GITHUB_OUTPUT;
    });

    it('stages an existing non-empty .apk file, copies it to destination, and validates byte parity', () => {
      const srcApk = path.join(stageSrcDir, 'app-release.apk');
      const destApk = path.join(stageDestDir, 'MoneyManager-v1.0.0.apk');
      const fakeApkContent = Buffer.from('FAKE-APK-RELEASE-BINARY-STREAM-12345');
      fs.writeFileSync(srcApk, fakeApkContent);

      const result = stageLocalApk(srcApk, destApk, {
        owner: 'Techkilladis',
        repo: 'MoneyManager',
        tag: 'v1.0.0',
      });

      expect(fs.existsSync(destApk)).toBe(true);
      expect(fs.readFileSync(destApk)).toEqual(fakeApkContent);
      expect(result).toEqual({
        path: path.resolve(destApk),
        size: fakeApkContent.length,
        filename: 'MoneyManager-v1.0.0.apk',
        directDownloadUrl:
          'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.0/MoneyManager-v1.0.0.apk',
        valid: true,
      });
    });

    it('generates direct_download_url matching GitHub release asset format', () => {
      const srcApk = path.join(stageSrcDir, 'source.apk');
      const destApk = path.join(stageDestDir, 'target.apk');
      fs.writeFileSync(srcApk, Buffer.from('TEST-APK-DATA'));

      const result = stageLocalApk(srcApk, destApk, {
        owner: 'CustomOwner',
        repo: 'CustomRepo',
        tag: 'v2.5.0',
      });

      expect(result.directDownloadUrl).toBe(
        'https://github.com/CustomOwner/CustomRepo/releases/download/v2.5.0/target.apk'
      );
    });

    it('writes apk_path, apk_filename, apk_size, and direct_download_url to GITHUB_OUTPUT if defined', () => {
      const srcApk = path.join(stageSrcDir, 'output-test.apk');
      const destApk = path.join(stageDestDir, 'output-dest.apk');
      const outputFile = path.join(tmpDir, 'stage_gh_output.txt');
      fs.writeFileSync(srcApk, Buffer.from('APK-PAYLOAD'));
      fs.writeFileSync(outputFile, '');

      process.env.GITHUB_OUTPUT = outputFile;

      stageLocalApk(srcApk, destApk, {
        owner: 'Techkilladis',
        repo: 'MoneyManager',
        tag: 'v1.2.3',
      });

      const outputContent = fs.readFileSync(outputFile, 'utf8');
      expect(outputContent).toContain(`apk_path=${path.resolve(destApk)}\n`);
      expect(outputContent).toContain('apk_filename=output-dest.apk\n');
      expect(outputContent).toContain(`apk_size=${Buffer.from('APK-PAYLOAD').length}\n`);
      expect(outputContent).toContain(
        'direct_download_url=https://github.com/Techkilladis/MoneyManager/releases/download/v1.2.3/output-dest.apk\n'
      );
    });

    it('throws descriptive error if source file does not exist', () => {
      const missingApk = path.join(stageSrcDir, 'missing.apk');
      const destApk = path.join(stageDestDir, 'dest.apk');

      expect(() => stageLocalApk(missingApk, destApk)).toThrow(
        /APK file does not exist:/i
      );
    });

    it('throws descriptive error if source file is 0 bytes', () => {
      const emptyApk = path.join(stageSrcDir, 'empty.apk');
      const destApk = path.join(stageDestDir, 'dest.apk');
      fs.writeFileSync(emptyApk, Buffer.alloc(0));

      expect(() => stageLocalApk(emptyApk, destApk)).toThrow(
        /APK file is empty \(0 bytes\):/i
      );
    });

    it('throws descriptive error if source file lacks .apk extension', () => {
      const invalidExt = path.join(stageSrcDir, 'not-an-apk.txt');
      const destApk = path.join(stageDestDir, 'dest.apk');
      fs.writeFileSync(invalidExt, Buffer.from('Hello'));

      expect(() => stageLocalApk(invalidExt, destApk)).toThrow(
        /must end with \.apk extension/i
      );
    });

    it('creates destination directory if it does not already exist', () => {
      const srcApk = path.join(stageSrcDir, 'nested-test.apk');
      const nestedDestApk = path.join(stageDestDir, 'sub', 'nested', 'MoneyManager-v1.0.0.apk');
      fs.writeFileSync(srcApk, Buffer.from('NESTED-APK-CONTENT'));

      const result = stageLocalApk(srcApk, nestedDestApk, { tag: 'v1.0.0' });

      expect(fs.existsSync(nestedDestApk)).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('throws error on byte parity mismatch if destination size differs from source', () => {
      const srcApk = path.join(stageSrcDir, 'parity-src.apk');
      const destApk = path.join(stageDestDir, 'parity-dest.apk');
      fs.writeFileSync(srcApk, Buffer.from('ORIGINAL-FULL-DATA'));

      const copySpy = jest.spyOn(fs, 'copyFileSync').mockImplementation((_src, dest) => {
        fs.writeFileSync(dest as string, Buffer.from('SHORT'));
      });

      try {
        expect(() => stageLocalApk(srcApk, destApk)).toThrow(/Byte parity mismatch/i);
      } finally {
        copySpy.mockRestore();
      }
    });
  });

  describe('CLI execution with local APK staging', () => {
    const scriptPath = path.resolve(__dirname, '../download-build-artifact.js');
    const cliSrcDir = path.join(tmpDir, 'cli-src');
    const cliDestDir = path.join(tmpDir, 'cli-dest');

    beforeEach(() => {
      if (!fs.existsSync(cliSrcDir)) {
        fs.mkdirSync(cliSrcDir, { recursive: true });
      }
      if (!fs.existsSync(cliDestDir)) {
        fs.mkdirSync(cliDestDir, { recursive: true });
      }
    });

    it('stages the file and exits 0 when called with --local-apk, --output, and --tag', () => {
      const srcApk = path.join(cliSrcDir, 'cli-release.apk');
      const destApk = path.join(cliDestDir, 'MoneyManager-v2.0.0.apk');
      const outputFile = path.join(tmpDir, 'cli_output_1.txt');
      fs.writeFileSync(srcApk, Buffer.from('CLI-APK-DATA-1'));
      fs.writeFileSync(outputFile, '');

      const stdout = execSync(
        `node "${scriptPath}" --local-apk "${srcApk}" --output "${destApk}" --tag v2.0.0`,
        {
          env: { ...process.env, GITHUB_OUTPUT: outputFile, GITHUB_REPOSITORY: 'Techkilladis/MoneyManager' },
          encoding: 'utf8',
        }
      );

      expect(stdout).toMatch(/APK successfully (verified and )?staged/i);
      expect(fs.existsSync(destApk)).toBe(true);
      expect(fs.readFileSync(destApk, 'utf8')).toBe('CLI-APK-DATA-1');

      const ghOutput = fs.readFileSync(outputFile, 'utf8');
      expect(ghOutput).toContain(`apk_path=${destApk}`);
      expect(ghOutput).toContain('apk_filename=MoneyManager-v2.0.0.apk');
      expect(ghOutput).toContain(
        'direct_download_url=https://github.com/Techkilladis/MoneyManager/releases/download/v2.0.0/MoneyManager-v2.0.0.apk'
      );
    });

    it('routes --input <src.apk> to local staging when input ends with .apk and exists', () => {
      const srcApk = path.join(cliSrcDir, 'routed-input.apk');
      const destApk = path.join(cliDestDir, 'MoneyManager-v2.1.0.apk');
      const outputFile = path.join(tmpDir, 'cli_output_2.txt');
      fs.writeFileSync(srcApk, Buffer.from('CLI-APK-DATA-ROUTED'));
      fs.writeFileSync(outputFile, '');

      const stdout = execSync(
        `node "${scriptPath}" --input "${srcApk}" --output "${destApk}" --tag v2.1.0`,
        {
          env: { ...process.env, GITHUB_OUTPUT: outputFile, GITHUB_REPOSITORY: 'Techkilladis/MoneyManager' },
          encoding: 'utf8',
        }
      );

      expect(stdout).toMatch(/APK successfully (verified and )?staged/i);
      expect(fs.existsSync(destApk)).toBe(true);
      expect(fs.readFileSync(destApk, 'utf8')).toBe('CLI-APK-DATA-ROUTED');

      const ghOutput = fs.readFileSync(outputFile, 'utf8');
      expect(ghOutput).toContain(`apk_path=${destApk}`);
      expect(ghOutput).toContain('apk_filename=MoneyManager-v2.1.0.apk');
    });

    it('exits with code 1 and error message when --local-apk file does not exist', () => {
      const missingApk = path.join(cliSrcDir, 'non-existent-file.apk');
      const destApk = path.join(cliDestDir, 'MoneyManager-v3.0.0.apk');

      expect(() => {
        execSync(
          `node "${scriptPath}" --local-apk "${missingApk}" --output "${destApk}" --tag v3.0.0`,
          {
            stdio: 'pipe',
            encoding: 'utf8',
          }
        );
      }).toThrow();
    });
  });
});

