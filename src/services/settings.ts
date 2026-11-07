/**
 * Small typed key/value store for app preferences (theme, app lock,
 * onboarding, alert bookkeeping...). Values are JSON in `app_settings` and
 * cached in memory after the first read.
 */
import { openDatabase } from '../database/db';

export type ThemePreference = 'system' | 'light' | 'dark';
export type LockTimeout = 0 | 60_000 | 300_000;

export interface SettingsShape {
  theme: ThemePreference;
  onboardingDone: boolean;
  appLockEnabled: boolean;
  /** How long the app may stay in the background before it locks again. */
  appLockTimeoutMs: LockTimeout;
  budgetAlertsEnabled: boolean;
  recapEnabled: boolean;
  billRemindersEnabled: boolean;
  /** Your own UPI ID, used in "pay me back" requests for split expenses. */
  upiId: string;
  upiName: string;
  /** Budget alert thresholds already sent, keyed `${budgetId}:${YYYY-MM}`. */
  budgetAlertsSent: Record<string, number>;
  /** Month keys (YYYY-MM) whose recap card was dismissed on Home. */
  recapDismissed: string[];
  /** Merchant keys the user said are not recurring. */
  recurringIgnored: string[];
  lastBackupAt: number | null;
  /** Overall monthly spending budget in paise (0 = not set). */
  overallBudgetPaise: number;
  /** Background-capture setup steps the user has opened (their state can't always be read). */
  captureStepsOpened: string[];
  /** Whether UPI notifications create pending events silently ('auto') or open quick-capture instantly ('instant'). */
  captureMode: 'instant' | 'auto';
}

const DEFAULTS: SettingsShape = {
  theme: 'system',
  onboardingDone: false,
  appLockEnabled: false,
  appLockTimeoutMs: 60_000,
  budgetAlertsEnabled: true,
  recapEnabled: true,
  billRemindersEnabled: true,
  upiId: '',
  upiName: '',
  budgetAlertsSent: {},
  recapDismissed: [],
  recurringIgnored: [],
  lastBackupAt: null,
  overallBudgetPaise: 0,
  captureStepsOpened: [],
  captureMode: 'instant', // default: open quick-capture instantly on UPI notification
};

type Key = keyof SettingsShape;

const cache = new Map<Key, unknown>();
type Listener = (key: Key) => void;
const listeners = new Set<Listener>();

export async function getSetting<K extends Key>(key: K): Promise<SettingsShape[K]> {
  if (cache.has(key)) return cache.get(key) as SettingsShape[K];
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  let value: SettingsShape[K] = DEFAULTS[key];
  if (row) {
    try {
      value = JSON.parse(row.value) as SettingsShape[K];
    } catch {
      value = DEFAULTS[key];
    }
  }
  cache.set(key, value);
  return value;
}

export async function setSetting<K extends Key>(key: K, value: SettingsShape[K]): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)]
  );
  cache.set(key, value);
  listeners.forEach((l) => l(key));
}

export async function getSettings<K extends Key>(keys: K[]): Promise<Pick<SettingsShape, K>> {
  const values = await Promise.all(keys.map((k) => getSetting(k)));
  const out = {} as Pick<SettingsShape, K>;
  keys.forEach((k, i) => {
    out[k] = values[i];
  });
  return out;
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drops the in-memory cache, e.g. after restoring a backup. */
export function resetSettingsCache(): void {
  cache.clear();
  (Object.keys(DEFAULTS) as Key[]).forEach((k) => listeners.forEach((l) => l(k)));
}

export const settingsDefaults = DEFAULTS;
