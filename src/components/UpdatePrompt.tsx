import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useTheme } from '@/design/theme';
import { Card, Icon, Text } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { space } from '@/design/tokens';

/**
 * Checks for OTA updates on mount and after a short delay so the app finishes
 * its initial paint before prompting the user.
 *
 * When an update is available it shows a modal card with two actions:
 *  - "Update now" — fetches and applies the update, then restarts the app.
 *  - "Later"      - dismisses the prompt until the next check.
 */
export function UpdatePrompt() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [visible, setVisible] = useState(false);

  const checkUpdate = useCallback(async () => {
    try {
      const { isAvailable: available } = await Updates.checkForUpdateAsync();
      if (available) {
        setVisible(true);
      }
    } catch {
      // Network or other error — silently skip
    }
  }, []);

  useEffect(() => {
    // Delay the first check so the initial render is not blocked
    const timer = setTimeout(checkUpdate, 2000);
    return () => clearTimeout(timer);
  }, [checkUpdate]);

  const handleUpdate = useCallback(async () => {
    try {
      await Updates.fetchUpdateAsync();
      // Expo Router will pick up the new update on reload
      await Updates.reloadAsync();
    } catch {
      // Fetch failed — keep the prompt visible
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onDismiss={handleDismiss}>
      <View style={styles.overlay}>
        <Card padded style={styles.card}>
          <View style={styles.header}>
            <Icon name="info" size={24} color={colors.brand} />
            <Text variant="heading" style={styles.title}>
              Update available
            </Text>
          </View>
          <Text variant="body" style={styles.description}>
            A new version is ready. Update now to get the latest improvements and bug fixes.
          </Text>
          <View style={styles.actions}>
            <Button title="Update now" onPress={handleUpdate} style={styles.updateButton} />
            <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
              <Text variant="body" style={styles.dismissText}>
                Later
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    card: {
      marginBottom: space.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      marginBottom: space.lg,
    },
    title: {
      color: colors.brand,
    },
    description: {
      marginBottom: space.xl,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    updateButton: {
      flex: 1,
    },
    dismissButton: {
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    dismissText: {
      color: colors.textTertiary,
    },
  });
};
