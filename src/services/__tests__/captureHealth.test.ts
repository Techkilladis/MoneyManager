import { captureSteps, decideCaptureState, missedWhileClosed } from '../captureHealth';
import type { CaptureHealth } from '../notificationDetection';

const NOW = new Date(2026, 9, 17, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;

function health(overrides: Partial<CaptureHealth> = {}): CaptureHealth {
  return {
    accessEnabled: true,
    lastUpiMessageAt: NOW - DAY,
    lastCaptureAt: NOW - DAY,
    manufacturer: 'Xiaomi',
    sdkInt: 34,
    widgetCount: 0,
    ...overrides,
  };
}

describe('auto-capture health', () => {
  it('is unsupported without the native module', () => {
    expect(decideCaptureState(null, null).state).toBe('unsupported');
  });

  it('is off when the SMS permission is missing', () => {
    expect(decideCaptureState(health({ accessEnabled: false }), null).state).toBe('off');
  });

  it('is ok when the SMS permission is granted', () => {
    expect(decideCaptureState(health(), null).state).toBe('ok');
  });

  it('reports the most recent sign of life', () => {
    const h = health({ lastUpiMessageAt: NOW - 5 * DAY, lastCaptureAt: NOW - 3 * DAY });
    expect(decideCaptureState(h, NOW - DAY)).toEqual({ state: 'ok', lastSeenAt: NOW - DAY });
  });

  it('has no last-seen time before anything was captured', () => {
    const h = health({ lastUpiMessageAt: null, lastCaptureAt: null });
    expect(decideCaptureState(h, null)).toEqual({ state: 'ok', lastSeenAt: null });
  });
});

describe('pop-up when the app is closed', () => {
  const keys = (h: CaptureHealth, opened: string[] = []) => captureSteps(h, opened).map((s) => `${s.key}:${s.done}`);

  it('has no steps until SMS access is granted', () => {
    expect(captureSteps(health({ accessEnabled: false }), [])).toEqual([]);
    expect(captureSteps(null, [])).toEqual([]);
  });

  it('asks only for overlay and battery on stock Android', () => {
    const h = health({ isXiaomi: false, hasAutostartSetting: false, popupEnabled: true, batteryUnrestricted: false });
    expect(keys(h)).toEqual(['popup:true', 'battery:false']);
  });

  it('adds the Xiaomi background pop-up and Autostart switches', () => {
    const h = health({ isXiaomi: true, hasAutostartSetting: true, backgroundPopupAllowed: false });
    expect(keys(h)).toEqual(['popup:false', 'miuiPopup:false', 'autostart:false', 'battery:false']);
  });

  it('trusts a readable state over whether the user opened the screen', () => {
    const h = health({ isXiaomi: true, backgroundPopupAllowed: false });
    expect(keys(h, ['miuiPopup'])).toContain('miuiPopup:false');
  });

  it('counts an unreadable step as done once opened', () => {
    const h = health({ isXiaomi: true, hasAutostartSetting: true, backgroundPopupAllowed: null });
    expect(keys(h, ['miuiPopup', 'autostart'])).toEqual(['popup:false', 'miuiPopup:true', 'autostart:true', 'battery:false']);
  });

  it('reopens Autostart after a payment was missed', () => {
    const h = health({ hasAutostartSetting: true, lastMissedAt: NOW, lastReceiverAt: NOW - DAY });
    expect(missedWhileClosed(h)).toBe(true);
    expect(keys(h, ['autostart'])).toContain('autostart:false');
  });

  it('clears the miss once the live receiver runs again', () => {
    expect(missedWhileClosed(health({ lastMissedAt: NOW - DAY, lastReceiverAt: NOW }))).toBe(false);
    expect(missedWhileClosed(health({ lastMissedAt: NOW, lastReceiverAt: null }))).toBe(true);
    expect(missedWhileClosed(health({ lastMissedAt: null }))).toBe(false);
  });
});
