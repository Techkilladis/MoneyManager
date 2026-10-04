import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen, Body } from '@/design/primitives';

export default function LoadingScreen() {
  return (
    <Screen style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0071e3" />
        <Body style={styles.loadingText} color="rgba(0,0,0,0.38)">
          Loading Money Manager…
        </Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    marginTop: 8,
  },
});