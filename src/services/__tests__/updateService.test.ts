import * as Updates from 'expo-updates';
import {
  checkForUpdates,
  compareSemVer,
  fetchOtaUpdate,
  findApkAsset,
  GITHUB_RELEASES_LATEST_URL,
  isNewerVersion,
  reloadApp,
  updateService,
} from '../updateService';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
}));

describe('updateService - SemVer Comparison', () => {
  describe('compareSemVer', () => {
    it('returns 0 for identical versions', () => {
      expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemVer('v1.0.0', '1.0.0')).toBe(0);
      expect(compareSemVer('1.0.0', 'v1.0.0')).toBe(0);
      expect(compareSemVer('v2.1.3', 'v2.1.3')).toBe(0);
    });

    it('returns 1 when first version has higher patch', () => {
      expect(compareSemVer('1.0.1', '1.0.0')).toBe(1);
      expect(compareSemVer('v1.0.10', 'v1.0.2')).toBe(1);
    });

    it('returns -1 when first version has lower patch', () => {
      expect(compareSemVer('1.0.0', '1.0.1')).toBe(-1);
      expect(compareSemVer('v1.0.2', 'v1.0.10')).toBe(-1);
    });

    it('returns 1 when first version has higher minor', () => {
      expect(compareSemVer('1.1.0', '1.0.9')).toBe(1);
      expect(compareSemVer('1.10.0', '1.9.0')).toBe(1);
    });

    it('returns -1 when first version has lower minor', () => {
      expect(compareSemVer('1.0.9', '1.1.0')).toBe(-1);
      expect(compareSemVer('1.9.0', '1.10.0')).toBe(-1);
    });

    it('returns 1 when first version has higher major', () => {
      expect(compareSemVer('2.0.0', '1.99.99')).toBe(1);
    });

    it('returns -1 when first version has lower major', () => {
      expect(compareSemVer('1.99.99', '2.0.0')).toBe(-1);
    });

    it('handles pre-release precedence: normal release > pre-release', () => {
      expect(compareSemVer('1.0.0', '1.0.0-rc.1')).toBe(1);
      expect(compareSemVer('1.0.0-rc.1', '1.0.0')).toBe(-1);
    });

    it('handles pre-release ordering among pre-releases', () => {
      expect(compareSemVer('1.0.0-beta.2', '1.0.0-beta.1')).toBe(1);
      expect(compareSemVer('1.0.0-beta', '1.0.0-alpha')).toBe(1);
      expect(compareSemVer('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    });
  });

  describe('isNewerVersion', () => {
    it('returns true if remote version is strictly greater than installed version', () => {
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
      expect(isNewerVersion('v1.1.0', '1.0.5')).toBe(true);
      expect(isNewerVersion('v2.0.0', '1.0.0')).toBe(true);
    });

    it('returns false if remote version is equal or lower than installed version', () => {
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('v1.0.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
      expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
    });
  });

  describe('findApkAsset', () => {
    it('returns the APK asset when present in the assets list', () => {
      const assets = [
        { name: 'source.zip', browser_download_url: 'https://example.com/source.zip' },
        { name: 'MoneyManager-1.0.1.apk', browser_download_url: 'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.1/MoneyManager-1.0.1.apk' },
      ];
      const match = findApkAsset(assets);
      expect(match).toEqual({
        name: 'MoneyManager-1.0.1.apk',
        browser_download_url: 'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.1/MoneyManager-1.0.1.apk',
      });
    });

    it('matches .apk case-insensitively', () => {
      const assets = [
        { name: 'APP-RELEASE.APK', browser_download_url: 'https://example.com/app.apk' },
      ];
      const match = findApkAsset(assets);
      expect(match?.name).toBe('APP-RELEASE.APK');
    });

    it('returns null if no asset has an .apk extension', () => {
      const assets = [
        { name: 'source.tar.gz', browser_download_url: 'https://example.com/source.tar.gz' },
        { name: 'checksums.txt', browser_download_url: 'https://example.com/checksums.txt' },
      ];
      expect(findApkAsset(assets)).toBeNull();
    });

    it('returns null when assets array is empty, null, or undefined', () => {
      expect(findApkAsset([])).toBeNull();
      expect(findApkAsset(null)).toBeNull();
      expect(findApkAsset(undefined)).toBeNull();
    });

    it('ignores assets without a valid browser_download_url', () => {
      const assets = [
        { name: 'app.apk', browser_download_url: '' },
      ];
      expect(findApkAsset(assets)).toBeNull();
    });
  });

  describe('checkForUpdates - Native update detection', () => {
    const mockRelease = {
      tag_name: 'v1.0.1',
      name: 'Release 1.0.1',
      body: 'Bug fixes and performance improvements',
      draft: false,
      prerelease: false,
      assets: [
        {
          name: 'MoneyManager-1.0.1.apk',
          browser_download_url: 'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.1/MoneyManager-1.0.1.apk',
        },
      ],
    };

    it('returns a native update result when GitHub release is newer and has an APK asset', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: { isEnabled: false, checkForUpdateAsync: jest.fn() },
      });

      expect(fetchFn).toHaveBeenCalledWith(
        GITHUB_RELEASES_LATEST_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github.v3+json',
          }),
        })
      );
      expect(result).toEqual({
        type: 'native',
        latestVersion: '1.0.1',
        currentVersion: '1.0.0',
        downloadUrl: 'https://github.com/Techkilladis/MoneyManager/releases/download/v1.0.1/MoneyManager-1.0.1.apk',
        releaseName: 'Release 1.0.1',
        releaseNotes: 'Bug fixes and performance improvements',
      });
    });

    it('respects a custom GitHub endpoint if provided in options', async () => {
      const customUrl = 'https://custom-api.example.com/releases/latest';
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      await checkForUpdates({
        githubEndpoint: customUrl,
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: { isEnabled: false, checkForUpdateAsync: jest.fn() },
      });

      expect(fetchFn).toHaveBeenCalledWith(customUrl, expect.anything());
    });

    it('returns none when the release tag is equal to installed version', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease, // tag is v1.0.1
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.1',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: { isEnabled: false, checkForUpdateAsync: jest.fn() },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('returns none when the release tag is older than installed version', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease, // tag is v1.0.1
      });

      const result = await checkForUpdates({
        installedVersion: '1.2.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: { isEnabled: false, checkForUpdateAsync: jest.fn() },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('returns none when the release has no APK asset attached', async () => {
      const releaseWithoutApk = {
        ...mockRelease,
        assets: [
          { name: 'source.tar.gz', browser_download_url: 'https://example.com/source.tar.gz' },
        ],
      };
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => releaseWithoutApk,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: { isEnabled: false, checkForUpdateAsync: jest.fn() },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('ignores draft releases', async () => {
      const draftRelease = {
        ...mockRelease,
        draft: true,
      };
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => draftRelease,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: { isEnabled: false, checkForUpdateAsync: jest.fn() },
      });

      expect(result).toEqual({ type: 'none' });
    });
  });

  describe('checkForUpdates - OTA update detection', () => {
    it('returns an OTA update result when Updates.isEnabled is true and an OTA update is available', async () => {
      const mockManifest = { id: 'ota-update-123' };
      const checkForUpdateAsync = jest.fn().mockResolvedValue({
        isAvailable: true,
        manifest: mockManifest,
      });

      // No native release found
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: true,
          checkForUpdateAsync,
        },
      });

      expect(checkForUpdateAsync).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'ota',
        manifest: mockManifest,
      });
    });

    it('does not check OTA updates and returns none when Updates.isEnabled is false', async () => {
      const checkForUpdateAsync = jest.fn();
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: false,
          checkForUpdateAsync,
        },
      });

      expect(checkForUpdateAsync).not.toHaveBeenCalled();
      expect(result).toEqual({ type: 'none' });
    });

    it('returns none when checkForUpdateAsync reports isAvailable as false', async () => {
      const checkForUpdateAsync = jest.fn().mockResolvedValue({
        isAvailable: false,
      });
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: true,
          checkForUpdateAsync,
        },
      });

      expect(result).toEqual({ type: 'none' });
    });
  });

  describe('checkForUpdates - Precedence enforcement', () => {
    it('returns native update and suppresses OTA update when both are available', async () => {
      const mockRelease = {
        tag_name: 'v2.0.0',
        name: 'Major Release 2.0.0',
        body: 'Native architecture changes',
        draft: false,
        assets: [
          {
            name: 'MoneyManager-2.0.0.apk',
            browser_download_url: 'https://github.com/Techkilladis/MoneyManager/releases/download/v2.0.0/MoneyManager-2.0.0.apk',
          },
        ],
      };

      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      const checkForUpdateAsync = jest.fn().mockResolvedValue({
        isAvailable: true,
        manifest: { id: 'pending-ota-update' },
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: true,
          checkForUpdateAsync,
        },
      });

      // Must return native update
      expect(result.type).toBe('native');
      if (result.type === 'native') {
        expect(result.latestVersion).toBe('2.0.0');
        expect(result.downloadUrl).toBe(
          'https://github.com/Techkilladis/MoneyManager/releases/download/v2.0.0/MoneyManager-2.0.0.apk'
        );
      }

      // OTA update check must be suppressed
      expect(checkForUpdateAsync).not.toHaveBeenCalled();
    });

    it('falls back to OTA update when GitHub release version is not newer', async () => {
      const currentRelease = {
        tag_name: 'v1.0.0',
        assets: [
          {
            name: 'MoneyManager-1.0.0.apk',
            browser_download_url: 'https://example.com/app.apk',
          },
        ],
      };

      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => currentRelease,
      });

      const mockManifest = { id: 'patch-ota-bundle' };
      const checkForUpdateAsync = jest.fn().mockResolvedValue({
        isAvailable: true,
        manifest: mockManifest,
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: true,
          checkForUpdateAsync,
        },
      });

      expect(checkForUpdateAsync).toHaveBeenCalled();
      expect(result).toEqual({
        type: 'ota',
        manifest: mockManifest,
      });
    });
  });

  describe('checkForUpdates - Offline and error resilience', () => {
    it('handles network failure (offline) silently without throwing', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
      const checkForUpdateAsync = jest.fn().mockRejectedValue(new Error('OTA offline error'));

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: true,
          checkForUpdateAsync,
        },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('handles GitHub API rate limiting (HTTP 403) silently', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'rate limit exceeded',
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: false,
          checkForUpdateAsync: jest.fn(),
        },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('handles malformed JSON response from GitHub silently', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: false,
          checkForUpdateAsync: jest.fn(),
        },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('handles timeout/abort during GitHub fetch silently', async () => {
      const fetchFn = jest.fn().mockImplementation((_url, options) => {
        return new Promise((_, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortErr = new Error('The user aborted a request.');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const result = await checkForUpdates({
        installedVersion: '1.0.0',
        fetchFn: fetchFn as unknown as typeof fetch,
        timeoutMs: 10,
        updatesModule: {
          isEnabled: false,
          checkForUpdateAsync: jest.fn(),
        },
      });

      expect(result).toEqual({ type: 'none' });
    });

    it('handles missing or undefined installedVersion gracefully using fallback', async () => {
      const mockRelease = {
        tag_name: 'v2.0.0',
        draft: false,
        assets: [
          {
            name: 'MoneyManager.apk',
            browser_download_url: 'https://example.com/MoneyManager.apk',
          },
        ],
      };

      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      // installedVersion omitted -> falls back to Constants.expoConfig?.version ?? '1.0.0'
      const result = await checkForUpdates({
        fetchFn: fetchFn as unknown as typeof fetch,
        updatesModule: {
          isEnabled: false,
          checkForUpdateAsync: jest.fn(),
        },
      });

      // Default version is '1.0.0' in tests/expoConfig, so v2.0.0 should be detected
      expect(result.type).toBe('native');
    });
  });

  describe('updateService helpers', () => {
    it('fetchOtaUpdate delegates to Updates.fetchUpdateAsync', async () => {
      const mockResult = { isNew: true, manifest: { id: 'test' } };
      jest.mocked(Updates.fetchUpdateAsync).mockResolvedValueOnce(mockResult as unknown as Updates.UpdateFetchResult);

      const result = await fetchOtaUpdate();
      expect(Updates.fetchUpdateAsync).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('reloadApp delegates to Updates.reloadAsync', async () => {
      jest.mocked(Updates.reloadAsync).mockResolvedValueOnce(undefined);

      await reloadApp();
      expect(Updates.reloadAsync).toHaveBeenCalled();
    });

    it('exposes methods via the updateService namespace object', () => {
      expect(updateService.checkForUpdates).toBe(checkForUpdates);
      expect(updateService.fetchOtaUpdate).toBe(fetchOtaUpdate);
      expect(updateService.reloadApp).toBe(reloadApp);
      expect(updateService.compareSemVer).toBe(compareSemVer);
      expect(updateService.isNewerVersion).toBe(isNewerVersion);
      expect(updateService.findApkAsset).toBe(findApkAsset);
      expect(updateService.GITHUB_RELEASES_LATEST_URL).toBe(GITHUB_RELEASES_LATEST_URL);
    });
  });
});
