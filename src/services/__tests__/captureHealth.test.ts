import { decideCaptureState } from '../captureHealth';
import type { CaptureHealth } from '../notificationDetection';

const NOW = new Date(2026, 9, 17, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;

function health(overrides: Partial<CaptureHealth> = {}): CaptureHealth {
  return {
    accessEnabled: true,
    listenerConnected: true,
    lastConnectedAt: NOW - 10 * DAY,
    lastDisconnectedAt: null,
    lastUpiNotificationAt: NOW - DAY,
    lastCaptureAt: NOW - DAY,
    ignoringBatteryOptimizations: true,
    manufacturer: 'Xiaomi',
    sdkInt: 34,
    widgetCount: 0,
    ...overrides,
  };
}

describe('auto-capture health', () => {
  it('is unsupported without the native module', () => {
    expect(decideCaptureState(null, null, NOW).state).toBe('unsupported');
  });

  it('is off without notification access', () => {
    expect(decideCaptureState(health({ accessEnabled: false }), null, NOW).state).toBe('off');
  });

  it('is paused when the listener disconnected after its last connect', () => {
    const h = health({ listenerConnected: false, lastDisconnectedAt: NOW - DAY, lastConnectedAt: NOW - 2 * DAY });
    expect(decideCaptureState(h, null, NOW).state).toBe('paused');
  });

  it('is not paused before the listener has ever reported', () => {
    const h = health({ listenerConnected: false, lastConnectedAt: null, lastDisconnectedAt: null });
    expect(decideCaptureState(h, null, NOW).state).toBe('ok');
  });

  it('warns when payments stopped arriving and battery saver may be the cause', () => {
    const h = health({ lastUpiNotificationAt: NOW - 5 * DAY, lastCaptureAt: NOW - 5 * DAY, ignoringBatteryOptimizations: false });
    const result = decideCaptureState(h, null, NOW);
    expect(result.state).toBe('quiet');
    expect(result.lastSeenAt).toBe(NOW - 5 * DAY);
  });

  it('treats a quiet spell as normal once background activity is allowed', () => {
    const h = health({ lastUpiNotificationAt: NOW - 5 * DAY, lastCaptureAt: NOW - 5 * DAY });
    expect(decideCaptureState(h, null, NOW).state).toBe('ok');
  });

  it('suggests allowing background activity otherwise', () => {
    expect(decideCaptureState(health({ ignoringBatteryOptimizations: false }), null, NOW).state).toBe('battery');
  });

  it('uses the newest of native and app-side timestamps', () => {
    const h = health({ lastUpiNotificationAt: null, lastCaptureAt: null, ignoringBatteryOptimizations: false });
    expect(decideCaptureState(h, NOW - 3600_000, NOW)).toEqual({ state: 'battery', lastSeenAt: NOW - 3600_000 });
  });
});
