/**
 * Turns the native SMS-permission state into one status the UI can show,
 * so auto-capture never fails silently. Also lists what the phone needs so a
 * new payment still pops up after the app is swiped away from Recents.
 */
import { Platform } from 'react-native';
import { openDatabase } from '../database/db';
import { CaptureHealth, notificationDetectionService } from './notificationDetection';
import { getSetting, setSetting } from './settings';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CaptureState = 'unsupported' | 'off' | 'ok';

export type CaptureStepKey = 'popup' | 'miuiPopup' | 'autostart' | 'battery';

export interface CaptureStep {
  key: CaptureStepKey;
  title: string;
  detail: string;
  done: boolean;
}

export interface CaptureStatus {
  state: CaptureState;
  /** Most recent UPI message or capture we know of. */
  lastSeenAt: number | null;
  /** New payments open the review screen by themselves. */
  popupEnabled: boolean;
  /** What keeps the pop-up working when the app is closed. */
  steps: CaptureStep[];
  /** The phone kept a payment SMS from the app and nothing has come through live since. */
  missed: boolean;
  health: CaptureHealth | null;
}

/** Pure decision (exported for tests). */
export function decideCaptureState(
  health: CaptureHealth | null,
  lastCapturedTx: number | null
): { state: CaptureState; lastSeenAt: number | null } {
  if (!health) return { state: 'unsupported', lastSeenAt: lastCapturedTx };
  const lastSeenAt = Math.max(health.lastUpiMessageAt ?? 0, health.lastCaptureAt ?? 0, lastCapturedTx ?? 0) || null;
  return { state: health.accessEnabled ? 'ok' : 'off', lastSeenAt };
}

/** Pure (exported for tests). Cleared once the live receiver runs again. */
export function missedWhileClosed(health: CaptureHealth | null): boolean {
  if (!health?.lastMissedAt) return false;
  return !health.lastReceiverAt || health.lastMissedAt > health.lastReceiverAt;
}

/**
 * Pure (exported for tests). Steps whose state Android can't report count as
 * done once the user has opened them, until a missed payment says otherwise.
 */
export function captureSteps(health: CaptureHealth | null, opened: string[]): CaptureStep[] {
  if (!health?.accessEnabled) return [];
  const missed = missedWhileClosed(health);
  const openedOk = (key: CaptureStepKey) => opened.includes(key) && !missed;

  const steps: CaptureStep[] = [
    {
      key: 'popup',
      title: 'Display over other apps',
      detail: 'Lets a new payment open Money Manager by itself',
      done: !!health.popupEnabled,
    },
  ];
  if (health.isXiaomi) {
    steps.push({
      key: 'miuiPopup',
      title: 'Pop-ups in the background',
      detail: 'Other permissions → "Display pop-up windows while running in the background"',
      done: health.backgroundPopupAllowed ?? openedOk('miuiPopup'),
    });
  }
  if (health.hasAutostartSetting) {
    steps.push({
      key: 'autostart',
      title: 'Autostart',
      detail: 'Lets a bank SMS wake Money Manager after you swipe it away',
      done: openedOk('autostart'),
    });
  }
  steps.push({
    key: 'battery',
    title: 'No battery restrictions',
    detail: 'Stops the phone from putting Money Manager to sleep',
    done: !!health.batteryUnrestricted,
  });
  return steps;
}

export async function getCaptureStatus(): Promise<CaptureStatus> {
  if (Platform.OS !== 'android' || !notificationDetectionService.isAvailable()) {
    return { state: 'unsupported', lastSeenAt: null, popupEnabled: false, steps: [], missed: false, health: null };
  }
  const [health, row, opened] = await Promise.all([
    notificationDetectionService.getCaptureHealth(),
    openDatabase().then((db) =>
      db.getFirstAsync<{ last: number | null }>(
        "SELECT MAX(createdAt) AS last FROM transactions WHERE sourceType = 'UPI_NOTIFICATION'"
      )
    ),
    getSetting('captureStepsOpened'),
  ]);
  const decided = decideCaptureState(health, row?.last ?? null);
  return {
    ...decided,
    popupEnabled: !!health?.popupEnabled,
    steps: captureSteps(health, opened),
    missed: decided.state === 'ok' && missedWhileClosed(health),
    health,
  };
}

/** Opens the system screen for a step and remembers that the user went there. */
export async function openCaptureStep(key: CaptureStepKey): Promise<void> {
  const opened = await getSetting('captureStepsOpened');
  if (!opened.includes(key)) await setSetting('captureStepsOpened', [...opened, key]);
  const native = notificationDetectionService;
  if (key === 'popup') await native.openPopupSettings();
  else if (key === 'miuiPopup') await native.openBackgroundPopupSettings();
  else if (key === 'autostart') await native.openAutostartSettings();
  else await native.requestBatteryUnrestricted();
}

export function daysSince(ts: number | null, now = Date.now()): number | null {
  if (!ts) return null;
  return Math.floor((now - ts) / DAY_MS);
}
