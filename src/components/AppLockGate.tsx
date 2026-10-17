/**
 * Covers the app with a lock screen on launch and after it has been in the
 * background longer than the chosen timeout. The app stays mounted
 * underneath, so unlocking returns to exactly where the user was.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { authenticate, clearLockSuppression, isLockSuppressed, suppressLock } from '@/services/appLock';
import { getSettings, subscribeSettings } from '@/services/settings';
import { haptic } from '@/utils/haptics';
import { Button, Icon, Text } from './ui';

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
        <LinearGradient
          colors={[colors.heroStart, colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.lock, { paddingBottom: insets.bottom + space.xxl }]}
        >
          <View style={styles.center}>
            <View style={styles.logo}>
              <Icon name="lock" size={34} color="#FFFFFF" />
            </View>
            <Text variant="title" color="#FFFFFF" align="center" style={{ marginTop: space.lg }}>
              Money Manager is locked
            </Text>
            <Text variant="body" color={colors.textOnDarkMuted} align="center" style={{ marginTop: space.xs }}>
              {failed ? "That didn't work. Try again." : 'Unlock with your fingerprint, face or screen lock.'}
            </Text>
          </View>
          <Button title="Unlock" icon="lock" size="lg" variant="secondary" fullWidth onPress={unlock} />
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    paddingHorizontal: space.xl,
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
