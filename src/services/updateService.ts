import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export const GITHUB_RELEASES_LATEST_URL =
  'https://api.github.com/repos/Techkilladis/MoneyManager/releases/latest';

export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

/**
 * Parses a semantic version string (e.g. "1.2.3", "v1.2.3", "1.0.0-beta.1").
 */
export function parseSemVer(versionStr: string): ParsedSemVer {
  const clean = (versionStr || '').trim().replace(/^[vV]/, '');
  const [versionWithoutBuild] = clean.split('+');
  const [mainPart, ...preParts] = versionWithoutBuild.split('-');
  const prereleaseStr = preParts.join('-');

  const parts = mainPart.split('.').map(p => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });

  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  const prerelease = prereleaseStr ? prereleaseStr.split('.') : [];

  return { major, minor, patch, prerelease };
}

/**
 * Compares two semantic version strings according to SemVer 2.0 rules.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if v1 === v2.
 */
export function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (p1.major !== p2.major) {
    return p1.major > p2.major ? 1 : -1;
  }
  if (p1.minor !== p2.minor) {
    return p1.minor > p2.minor ? 1 : -1;
  }
  if (p1.patch !== p2.patch) {
    return p1.patch > p2.patch ? 1 : -1;
  }

  const p1HasPre = p1.prerelease.length > 0;
  const p2HasPre = p2.prerelease.length > 0;

  if (!p1HasPre && !p2HasPre) {
    return 0;
  }
  if (!p1HasPre && p2HasPre) {
    return 1;
  }
  if (p1HasPre && !p2HasPre) {
    return -1;
  }

  const len = Math.max(p1.prerelease.length, p2.prerelease.length);
  for (let i = 0; i < len; i++) {
    const id1 = p1.prerelease[i];
    const id2 = p2.prerelease[i];

    if (id1 === undefined) return -1;
    if (id2 === undefined) return 1;
    if (id1 === id2) continue;

    const num1 = parseInt(id1, 10);
    const num2 = parseInt(id2, 10);
    const isNum1 = !isNaN(num1) && String(num1) === id1;
    const isNum2 = !isNaN(num2) && String(num2) === id2;

    if (isNum1 && isNum2) {
      return num1 > num2 ? 1 : -1;
    }
    if (isNum1 && !isNum2) {
      return -1;
    }
    if (!isNum1 && isNum2) {
      return 1;
    }
    return id1.localeCompare(id2) > 0 ? 1 : -1;
  }

  return 0;
}

/**
 * Checks if the remote version is strictly newer than the installed version.
 */
export function isNewerVersion(remoteVersion: string, installedVersion: string): boolean {
  return compareSemVer(remoteVersion, installedVersion) > 0;
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type?: string;
  size?: number;
  [key: string]: unknown;
}

/**
 * Finds an APK asset in the GitHub Release assets list.
 * Returns the asset metadata or null if no valid APK asset is found.
 */
export function findApkAsset(assets?: GitHubAsset[] | null): GitHubAsset | null {
  if (!assets || !Array.isArray(assets)) {
    return null;
  }

  const apkAsset = assets.find(asset => {
    if (!asset || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') {
      return false;
    }
    return asset.name.toLowerCase().endsWith('.apk') && asset.browser_download_url.trim().length > 0;
  });

  return apkAsset ?? null;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubAsset[];
  [key: string]: unknown;
}

export type UpdateCheckResult =
  | {
      type: 'native';
      latestVersion: string;
      currentVersion: string;
      downloadUrl: string;
      releaseName?: string;
      releaseNotes?: string;
    }
  | {
      type: 'ota';
      manifest?: Updates.Manifest;
    }
  | {
      type: 'none';
    };

export interface CheckForUpdatesOptions {
  githubEndpoint?: string;
  installedVersion?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  updatesModule?: {
    isEnabled: boolean;
    checkForUpdateAsync: () => Promise<Updates.UpdateCheckResult>;
  };
}

async function fetchLatestGitHubRelease(
  endpoint: string,
  fetchFn: typeof fetch,
  timeoutMs: number
): Promise<GitHubRelease | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetchFn(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'MoneyManagerApp',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubRelease;
    return data;
  } catch {
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Checks for both native APK updates and Over-The-Air (OTA) updates.
 * Native updates take precedence over OTA updates.
 */
export async function checkForUpdates(
  options?: CheckForUpdatesOptions
): Promise<UpdateCheckResult> {
  const installedVersion =
    options?.installedVersion ??
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '1.0.0';
  const githubEndpoint = options?.githubEndpoint ?? GITHUB_RELEASES_LATEST_URL;
  const fetchFn = options?.fetchFn ?? globalThis.fetch;
  const timeoutMs = options?.timeoutMs ?? 5000;

  // 1. Check for native update
  const release = await fetchLatestGitHubRelease(githubEndpoint, fetchFn, timeoutMs);
  if (release && !release.draft && release.tag_name) {
    const rawTag = release.tag_name;
    const cleanTag = rawTag.replace(/^[vV]/, '');
    if (isNewerVersion(cleanTag, installedVersion)) {
      const apkAsset = findApkAsset(release.assets);
      if (apkAsset) {
        return {
          type: 'native',
          latestVersion: cleanTag,
          currentVersion: installedVersion,
          downloadUrl: apkAsset.browser_download_url,
          releaseName: release.name,
          releaseNotes: release.body,
        };
      }
      // A newer native release exists, but APK asset is not yet available (e.g. EAS build in progress).
      // Precedence must still be enforced: suppress OTA updates and return none.
      return { type: 'none' };
    }
  }

  // 2. Check for runtime Over-the-Air (OTA) update with timeout protection
  const updates = options?.updatesModule ?? Updates;
  if (updates.isEnabled) {
    try {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error('OTA update check timed out'));
        }, timeoutMs);
      });

      try {
        const otaResult = await Promise.race([
          updates.checkForUpdateAsync(),
          timeoutPromise,
        ]);
        if (otaResult.isAvailable) {
          return {
            type: 'ota',
            manifest: otaResult.manifest,
          };
        }
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    } catch {
      // Platform update check failed silently
      return { type: 'none' };
    }
  }

  return { type: 'none' };
}

export const updateService = {
  checkForUpdates,
  compareSemVer,
  isNewerVersion,
  findApkAsset,
  GITHUB_RELEASES_LATEST_URL,
};

export default updateService;



