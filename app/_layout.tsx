import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Per-weight subpaths: the package root would bundle all 18 Inter faces.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import * as Notifications from 'expo-notifications';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { initNotifications, refreshScheduledNotifications, urlFromResponse } from '@/services/alerts';
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
  // Inter is bundled with the app and loads in a few ms; until then show only
  // the paper colour so text never flashes in the system font.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold });
  return (
    <ThemeProvider>
      {fontsLoaded || fontError ? <Root /> : <Blank />}
    </ThemeProvider>
  );
}

function Blank() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
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

    let timer: ReturnType<typeof setInterval> | null = setInterval(syncNative, FOREGROUND_SYNC_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncNative();
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
    // Defer the initial response check so AppLockGate can replay it after
    // the user unlocks (the first read here may be consumed before the lock
    // screen appears if the app was already mounted).  A 0 ms setTimeout
    // lets the lock gate do its own check first.
    setTimeout(() => {
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          openUrl(urlFromResponse(response));
          return Notifications.clearLastNotificationResponseAsync?.();
        })
        .catch(() => undefined);
    }, 0);
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
          <Stack.Screen name="voice-capture" options={{ animation: 'slide_from_bottom' }} />
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
      <View style={styles.logo}>
        <Icon name="wallet" size={32} color={colors.textOnBrand} />
      </View>
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
    borderRadius: radius.xxl,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
