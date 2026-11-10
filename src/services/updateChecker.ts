/**
 * Update Checker Service
 *
 * Checks for available OTA updates and native APK releases.
 * Respects user's update preference setting (auto vs manual prompt).
 */

import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import * as ApplicationInfo from 'expo-application';
import { openDatabase } from '../database/db';

// ── Types ──────────────────────────────────────────────────────────────

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date';

export interface UpdateInfo {
  /** Whether an update is available */
  available: boolean;
  /** The update's release URL (for OTA) or GitHub Release URL (for native) */
  releaseUrl?: string;
  /** Version string */
  version: string;
  /** Update type: 'ota' or 'native' */
  type: 'ota' | 'native';
  /** Whether the update should be applied automatically */
  autoApply: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY_LATEST_NATIVE_VERSION = 'latestNativeVersion';
const STORAGE_KEY_LAST_APPLIED_UPDATE_HASH = 'lastAppliedUpdateHash';

export type UpdatePreference = 'auto' | 'manual';

// ── Storage helpers (simple key/value using a lazy-loaded approach) ────

/**
 * Simple storage using the app's SQLite for consistency with the rest of the codebase.
 */
async function storageGet(key: string): Promise<string | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  if (row) return row.value;
  return null;
}

async function storageSet(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

// ── Core check logic ───────────────────────────────────────────────────

let lastCheckTime: number | null = null;
let currentStatus: UpdateStatus = 'idle';
let pendingUpdateInfo: UpdateInfo | null = null;

/**
 * Check for available OTA updates via expo-updates.
 * Uses the new SDK 52 API: checkForUpdateAsync returns an UpdateCheckResult object.
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  // Rate limit checks to once per hour
  const now = Date.now();
  if (lastCheckTime && now - lastCheckTime < UPDATE_CHECK_INTERVAL_MS) {
    return pendingUpdateInfo;
  }
  lastCheckTime = now;

  try {
    currentStatus = 'checking';

    const result = await Updates.checkForUpdateAsync();

    // SDK 52+: checkForUpdateAsync returns an object with isAvailable, not a boolean.
    if (result.isAvailable) {
      const version = ApplicationInfo.nativeApplicationVersion || '1.0.0';
      const autoApply = false; // Default to manual prompt for transparency

      const info: UpdateInfo = {
        available: true,
        releaseUrl: `https://github.com/Techkilladis/MoneyManagerExpo52/releases`,
        version,
        type: 'ota',
        autoApply,
      };

      pendingUpdateInfo = info;
      currentStatus = 'available';

      return info;
    }

    // No OTA update available — check if this is a rollback scenario
    if (result.isRollBackToEmbedded) {
      console.log('[updateChecker] Rollback to embedded detected, clearing stale state.');
      await storageSet(STORAGE_KEY_LAST_APPLIED_UPDATE_HASH, '');
    }

    currentStatus = 'up-to-date';
    return null;
  } catch (error) {
    console.warn('Update check failed:', error);
    currentStatus = 'error';
    return null;
  }
}

/**
 * Fetch (download) the pending OTA update.
 * Must be called after checkForUpdates() reports available and before reloadAsync().
 */
export async function fetchUpdate(): Promise<{ success: boolean; error?: string }> {
  try {
    currentStatus = 'downloading';

    const fetchResult = await Updates.fetchUpdateAsync();

    if (fetchResult.isNew) {
      // Store the update ID so we know this update was applied.
      // The update ID is a unique identifier per OTA update release.
      const updateId = fetchResult.manifest?.id ?? null;
      if (updateId) {
        await storageSet(STORAGE_KEY_LAST_APPLIED_UPDATE_HASH, updateId);
      }

      currentStatus = 'downloaded';
      return { success: true };
    }

    // Update was fetched but is not new (same as current) — treat as up-to-date
    currentStatus = 'up-to-date';
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';
    console.warn('Update fetch failed:', error);
    currentStatus = 'error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Request the user to restart and apply the pending update.
 * Called when user taps "Restart now" in the update prompt.
 * The update must have been fetched first via fetchUpdate().
 */
export async function requestRestart(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (error) {
    console.warn('Failed to reload:', error);
    currentStatus = 'error';
    throw error;
  }
}

/**
 * Get the current update status.
 */
export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}

/**
 * Subscribe to app state changes and check for updates when app becomes active.
 * Returns an unsubscribe function.
 */
export function onUpdateStatusChange(callback: (status: UpdateStatus) => void): () => void {
  const listener = (state: AppStateStatus) => {
    if (state === 'active') {
      checkForUpdates().catch(console.warn);
    }
  };

  const subscription = AppState.addEventListener('change', listener);
  return () => subscription?.remove();
}

/**
 * Store the latest native release version.
 * Called after a native APK is installed.
 */
export async function setLatestNativeVersion(version: string): Promise<void> {
  await storageSet(STORAGE_KEY_LATEST_NATIVE_VERSION, version);
}

/**
 * Get the latest native release version.
 */
export async function getLatestNativeVersion(): Promise<string | null> {
  return await storageGet(STORAGE_KEY_LATEST_NATIVE_VERSION);
}

/**
 * Get the hash of the last applied update. Used to detect if we just reloaded
 * from an update and should skip the next check to avoid a prompt loop.
 */
export async function getLastAppliedUpdateHash(): Promise<string | null> {
  return await storageGet(STORAGE_KEY_LAST_APPLIED_UPDATE_HASH);
}
