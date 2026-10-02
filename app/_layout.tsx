import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function RootLayout() {
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