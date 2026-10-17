import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { initNotifications, refreshScheduledNotifications, urlFromResponse } from '@/services/alerts';
import { healListener } from '@/services/captureHealth';
import { syncWidget } from '@/services/widget';
import { getSetting, setSetting } from '@/services/settings';
import { session } from '@/services/session';
import { openDatabase } from '@/database/db';
import { radius, space } from '@/design/tokens';
import { makeStyles, ThemeProvider, useTheme } from '@/design/theme';
import { AppLockGate } from '@/components/AppLockGate';
import { ErrorView, Icon, LoadingView, Text, ToastProvider } from '@/components/ui';

// While the app is open, pull new UPI captures periodically so a payment
// made in another app shows up without a restart.
const FOREGROUND_SYNC_MS = 20_000;

function syncNative() {
  transactionService
    .syncPendingNativeEvents()
    .then((created) => {
      if (created > 0) dataEvents.emit();
    })
    .catch((error) => console.warn('[RootLayout] Native sync failed:', error));
}

/** Debounced so a burst of writes schedules one refresh. */
function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

const afterDataChange = debounce(() => {
  void syncWidget();
  void refreshScheduledNotifications();
}, 800);

async function decideOnboarding(): Promise<void> {
  if (await getSetting('onboardingDone')) return;
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM transactions WHERE sourceType IS NULL OR sourceType != 'SEED_DATA'"
  );
  if ((row?.n ?? 0) > 0) {
    // Existing users already know the app.
    await setSetting('onboardingDone', true);
    return;
  }
  session.needsOnboarding = true;
}

function openUrl(url: string | null) {
  if (!url) return;
  // Let the navigator mount before navigating from a cold start.
  setTimeout(() => router.push(url as never), 50);
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const { colors, scheme } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const statusStyle = scheme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    let mounted = true;
    transactionService
      .initialize()
      .then(decideOnboarding)
      .then(() => {
        if (mounted) setState('ready');
      })
      .catch((error) => {
        console.error('[RootLayout] Initialization failed:', error);
        if (mounted) setState('error');
      });
    return () => {
      mounted = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (state !== 'ready') return;
    void initNotifications().then(refreshScheduledNotifications);
    void syncWidget();
    if (Platform.OS === 'android') void healListener();

    let timer: ReturnType<typeof setInterval> | null = setInterval(syncNative, FOREGROUND_SYNC_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncNative();
        if (Platform.OS === 'android') void healListener();
        if (!timer) timer = setInterval(syncNative, FOREGROUND_SYNC_MS);
      } else {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        void syncWidget();
      }
    });
    const unsubscribe = dataEvents.subscribe(afterDataChange);

    // Notification taps: budget alerts, recap and bill reminders carry a route.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        openUrl(urlFromResponse(response));
        return Notifications.clearLastNotificationResponseAsync?.();
      })
      .catch(() => undefined);
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => openUrl(urlFromResponse(response)));

    return () => {
      appState.remove();
      unsubscribe();
      tapSub.remove();
      if (timer) clearInterval(timer);
    };
  }, [state]);

  const retry = useCallback(() => {
    setState('loading');
    setAttempt((a) => a + 1);
  }, []);

  if (state === 'loading') return <Splash />;
  if (state === 'error') {
    return (
      <>
        <StatusBar style={statusStyle} />
        <ErrorView message="Your data couldn't be opened. Restart the app or try again." onRetry={retry} />
      </>
    );
  }

  return (
    <ToastProvider>
      <StatusBar style={statusStyle} />
      <AppLockGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="transactions/new" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="quick-capture" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="recap" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </AppLockGate>
    </ToastProvider>
  );
}

function Splash() {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.splash}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} style={styles.logo}>
        <Icon name="wallet" size={34} color={colors.textOnDark} />
      </LinearGradient>
      <Text variant="title" style={{ marginTop: space.lg }}>
        Money Manager
      </Text>
      <View style={{ height: 64 }}>
        <LoadingView />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: radius.xl + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
