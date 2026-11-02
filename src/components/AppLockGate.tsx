/**
 * Covers the app with a lock screen on launch and after it has been in the
 * background longer than the chosen timeout. The app stays mounted
 * underneath, so unlocking returns to exactly where the user was.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { authenticate, clearLockSuppression, isLockSuppressed, suppressLock } from '@/services/appLock';
import { getSettings, subscribeSettings } from '@/services/settings';
import { haptic } from '@/utils/haptics';
import { Button, Icon, Text } from './ui';

/** Re-check for a notification response or pending native events that
 *  arrived while the app was locked.  This covers the common case where
 *  a bank UPI notification opened the review pop-up — the response may
 *  have been consumed on the initial mount (before the lock appeared),
 *  so we need to re-read it (or fall back to pending events) after
 *  the user unlocks. */
async function replayPendingNotification(): Promise<void> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    const url = response?.notification?.request?.content?.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) {
      setTimeout(() => {
        try {
          const { router } = require('expo-router');
          (router as any).push(url);
        } catch (e) {
          console.warn('[AppLockGate] navigation failed:', e);
        }
      }, 300);
      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        // best-effort
      }
      return;
    }
    // Fallback: check for pending native UPI events that arrived while
    // the app was locked but were never surfaced (e.g. when the deep-
    // link response was consumed before the lock gate could replay it).
    const { transactionService } = require('@/services');
    const pending = await transactionService.getOldestPendingCapture?.();
    if (pending) {
      setTimeout(() => {
        try {
          const { router } = require('expo-router');
          (router as any).push('/quick-capture');
        } catch (e) {
          console.warn('[AppLockGate] navigation to quick-capture failed:', e);
        }
      }, 400);
    }
  } catch {
    // best-effort
  }
}

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const config = useRef({ enabled: false, timeoutMs: 60_000 });
  const backgroundAt = useRef<number | null>(null);
  const authenticating = useRef(false);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    const ok = await authenticate();
    authenticating.current = false;
    if (ok) {
      // The system prompt can bounce AppState; don't re-lock on the way back.
      suppressLock(1500);
      setFailed(false);
      setLocked(false);
      haptic.success();
      // Re-check for notification responses that arrived while the app was
      // locked (e.g. a bank SMS that opened the review pop-up).
      void replayPendingNotification();
    } else {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let first = true;
    const load = () =>
      getSettings(['appLockEnabled', 'appLockTimeoutMs'])
        .then(({ appLockEnabled, appLockTimeoutMs }) => {
          config.current = { enabled: appLockEnabled, timeoutMs: appLockTimeoutMs };
          // Lock on launch only; turning the lock on in Settings shouldn't lock you out mid-use.
          if (first && appLockEnabled) {
            setLocked(true);
            void unlock();
          }
          first = false;
        })
        .catch(() => undefined);
    load();
    return subscribeSettings((key) => {
      if (key === 'appLockEnabled' || key === 'appLockTimeoutMs') load();
    });
  }, [unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        if (!authenticating.current && !isLockSuppressed()) backgroundAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;
      const since = backgroundAt.current;
      backgroundAt.current = null;
      const suppressed = isLockSuppressed();
      clearLockSuppression();
      const { enabled, timeoutMs } = config.current;
      if (!enabled || suppressed || since === null || authenticating.current) return;
      if (Date.now() - since >= timeoutMs) {
        setLocked(true);
        void unlock();
      }
    });
    return () => sub.remove();
  }, [unlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.xl }]}>
          <View style={styles.center}>
            <View style={[styles.logo, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="lock" size={32} color={colors.text} />
            </View>
            <Text variant="title" align="center" style={{ marginTop: space.xl }}>
              Money Manager is locked
            </Text>
            <Text variant="body" color={colors.textSecondary} align="center" style={{ marginTop: space.xs }}>
              {failed ? "That didn't work. Try again." : 'Unlock with your fingerprint, face or screen lock.'}
            </Text>
          </View>
          <Button title="Unlock" icon="lock" size="lg" fullWidth onPress={unlock} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    paddingHorizontal: space.lg,
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
