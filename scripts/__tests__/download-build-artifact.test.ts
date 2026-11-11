import fs from 'fs';
import path from 'path';

// Seam under test: scripts/download-build-artifact.js
// We require the commonjs module under test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  parseBuildOutput,
  verifyApkFile,
  getDirectDownloadUrl,
  formatReleaseComment,
  downloadArtifact,
} = require('../download-build-artifact');

describe('download-build-artifact', () => {
  const tmpDir = path.resolve(__dirname, '../../test-tmp-apk');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
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

    it('has removed the non-functional /tmp daily build cap check', () => {
      expect(workflowContent).not.toContain('/tmp/eas-native-build-cap');
      expect(workflowContent).not.toContain('cap-check');
      expect(workflowContent).not.toContain('Native Build Skipped (Daily Cap Reached)');
    });

    it('executes EAS Android cloud build with --wait, --json, and production profile', () => {
      expect(workflowContent).toMatch(/eas.*build.*--platform\s+android.*--profile\s+production/);
      expect(workflowContent).toMatch(/--wait/);
      expect(workflowContent).toMatch(/--json/);
    });

    it('parses build artifact URL and downloads .apk into runner workspace', () => {
      expect(workflowContent).toMatch(/download-build-artifact\.js/);
      expect(workflowContent).toMatch(/apk/i);
    });

    it('verifies downloaded .apk file exists before release publication', () => {
      expect(workflowContent).toMatch(/verify/i);
    });

    it('publishes GitHub Release tagged with v{version} and attaches .apk asset directly', () => {
      expect(workflowContent).toMatch(/softprops\/action-gh-release@v2/);
      expect(workflowContent).toMatch(/\.apk/);
    });

    it('posts comment on merged PR containing release details and direct download link', () => {
      expect(workflowContent).toMatch(/releases\/download\//);
    });
  });
});

