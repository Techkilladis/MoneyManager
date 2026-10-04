import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { transactionService } from '@/services';
import LoadingScreen from './loading';

export default function RootLayout() {
  const [initialized, setInitialized] = React.useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await transactionService.initialize();
        if (mounted) setInitialized(true);
      } catch (error) {
        console.error('[RootLayout] Initialization failed:', error);
        if (mounted) setInitialized(true); // Still allow UI to show error
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  if (!initialized) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // iOS-specific safe area handling
        ...(Platform.OS === 'ios' ? { 
          contentStyle: { 
            paddingTop: 0 
          } 
        } : {}),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}