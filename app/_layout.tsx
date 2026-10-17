import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { colors, radius, space } from '@/design/tokens';
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

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    transactionService
      .initialize()
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
    let timer: ReturnType<typeof setInterval> | null = setInterval(syncNative, FOREGROUND_SYNC_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncNative();
        if (!timer) timer = setInterval(syncNative, FOREGROUND_SYNC_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      subscription.remove();
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
        <StatusBar style="dark" />
        <ErrorView message="Your data couldn't be opened. Restart the app or try again." onRetry={retry} />
      </>
    );
  }

  return (
    <ToastProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transactions/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="quick-capture" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </ToastProvider>
  );
}

function Splash() {
  return (
    <View style={styles.splash}>
      <StatusBar style="dark" />
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

const styles = StyleSheet.create({
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
});
