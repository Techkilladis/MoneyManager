/**
 * Turns the native listener/battery state into one status the UI can show,
 * so auto-capture never fails silently.
 */
import { Platform } from 'react-native';
import { openDatabase } from '../database/db';
import { CaptureHealth, notificationDetectionService } from './notificationDetection';

const DAY_MS = 24 * 60 * 60 * 1000;
/** No UPI notification for this long (after having had some) looks like a stopped listener. */
const QUIET_AFTER_MS = 3 * DAY_MS;

export type CaptureState = 'unsupported' | 'off' | 'paused' | 'quiet' | 'battery' | 'ok';

export interface CaptureStatus {
  state: CaptureState;
  /** Most recent UPI notification or capture we know of. */
  lastSeenAt: number | null;
  health: CaptureHealth | null;
}

/** Pure decision (exported for tests). */
export function decideCaptureState(
  health: CaptureHealth | null,
  lastCapturedTx: number | null,
  now = Date.now()
): { state: CaptureState; lastSeenAt: number | null } {
  if (!health) return { state: 'unsupported', lastSeenAt: lastCapturedTx };
  const lastSeenAt =
    Math.max(health.lastUpiNotificationAt ?? 0, health.lastCaptureAt ?? 0, lastCapturedTx ?? 0) || null;
  if (!health.accessEnabled) return { state: 'off', lastSeenAt };
  const disconnectedAfterConnect =
    !health.listenerConnected &&
    health.lastDisconnectedAt !== null &&
    (health.lastConnectedAt === null || health.lastDisconnectedAt > health.lastConnectedAt);
  if (disconnectedAfterConnect) return { state: 'paused', lastSeenAt };
  if (lastSeenAt !== null && now - lastSeenAt > QUIET_AFTER_MS && !health.ignoringBatteryOptimizations) {
    return { state: 'quiet', lastSeenAt };
  }
  if (!health.ignoringBatteryOptimizations) return { state: 'battery', lastSeenAt };
  return { state: 'ok', lastSeenAt };
}

export async function getCaptureStatus(): Promise<CaptureStatus> {
  if (Platform.OS !== 'android' || !notificationDetectionService.isAvailable()) {
    return { state: 'unsupported', lastSeenAt: null, health: null };
  }
  const [health, row] = await Promise.all([
    notificationDetectionService.getCaptureHealth(),
    openDatabase().then((db) =>
      db.getFirstAsync<{ last: number | null }>(
        "SELECT MAX(createdAt) AS last FROM transactions WHERE sourceType = 'UPI_NOTIFICATION'"
      )
    ),
  ]);
  const decided = decideCaptureState(health, row?.last ?? null);
  return { ...decided, health };
}

/** If access is on but the listener dropped, ask Android to reconnect it. */
export async function healListener(): Promise<void> {
  const health = await notificationDetectionService.getCaptureHealth();
  if (health?.accessEnabled && !health.listenerConnected) {
    await notificationDetectionService.requestListenerRebind();
  }
}

export function daysSince(ts: number | null, now = Date.now()): number | null {
  if (!ts) return null;
  return Math.floor((now - ts) / DAY_MS);
}
