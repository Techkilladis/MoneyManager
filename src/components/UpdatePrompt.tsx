/**
 * Update Prompt Component
 *
 * Displays an "Update available - restart now?" dialog when an OTA update
 * is detected. Respects the user's update preference setting.
 *
 * Update flow (SDK 52):
 *   1. checkForUpdates() → detects available update
 *   2. User clicks "Update & Restart"
 *   3. fetchUpdate() → downloads the bundle
 *   4. requestRestart() → reloadAsync() into the downloaded update
 *   5. On restart, checkForUpdates() sees no new update → up-to-date
 */

import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState as RNAppState } from 'react-native';
import { checkForUpdates, fetchUpdate, onUpdateStatusChange, UpdateInfo, UpdateStatus, requestRestart } from '../services/updateChecker';
import { Icon } from '../components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface UpdatePromptProps {
  /** Called when the user dismisses the update prompt without updating */
  onDismiss?: () => void;
}

export function UpdatePrompt({ onDismiss }: UpdatePromptProps) {
  const [showModal, setShowModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [appState, setAppState] = useState<'idle' | 'fetching' | 'reloading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Check for updates on mount
    checkForUpdates().then(info => {
      if (info?.available) {
        setUpdateInfo(info);
        setShowModal(true);
      }
    }).catch(console.warn);

    // Listen for status changes from the updateChecker service
    const unsubscribe = onUpdateStatusChange((newStatus: UpdateStatus) => {
      if (newStatus === 'available' && !showModal) {
        checkForUpdates().then(info => {
          if (info?.available) {
            setUpdateInfo(info);
            setShowModal(true);
          }
        }).catch(console.warn);
      }
    });

    // Check again when app comes to foreground
    const listener = (state: string) => {
      if (state === 'active' && !showModal) {
        checkForUpdates().then(info => {
          if (info?.available) {
            setUpdateInfo(info);
            setShowModal(true);
          }
        }).catch(console.warn);
      }
    };
    const sub = RNAppState.addEventListener('change', listener);

    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [showModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async () => {
    setShowModal(false);
    setAppState('fetching');
    setErrorMessage(null);

    try {
      // Step 1: Download the update bundle
      const fetchResult = await fetchUpdate();
      if (!fetchResult.success) {
        setAppState('error');
        setErrorMessage(fetchResult.error ?? 'Failed to download update. Please try again.');
        return;
      }

      // Step 2: Reload into the downloaded update
      setAppState('reloading');
      await requestRestart();
      // reloadAsync() resolves before posting the actual reload task.
      // No code below here is guaranteed to execute.
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during update';
      setAppState('error');
      setErrorMessage(`Update failed: ${message}`);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    setAppState('idle');
    setErrorMessage(null);
    onDismiss?.();
  };

  // Idle state — show the update prompt modal
  if (!showModal && appState === 'idle' && !updateInfo) return null;

  // Error state — user can retry or dismiss
  if (appState === 'error') {
    return (
      <Modal
        transparent
        animationType="fade"
        visible={true}
        presentationStyle="pageSheet"
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.header}>
              <Icon name="alert" size={32} color="#EF4444" />
              <Text style={styles.title}>Update Failed</Text>
            </View>

            <Text style={styles.description}>
              {errorMessage ?? 'An unexpected error occurred while updating.'}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.dismissButton]}
                onPress={handleDismiss}
              >
                <Text style={styles.dismissText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.updateButton]}
                onPress={handleUpdate}
              >
                <Icon name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.updateText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Fetching state — show download progress
  if (appState === 'fetching') {
    return (
      <Modal
        transparent
        animationType="fade"
        visible={true}
        presentationStyle="pageSheet"
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.header}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.title}>Downloading Update</Text>
            </View>

            <Text style={styles.description}>
              Downloading the latest version of Money Manager. This may take a moment depending on your network speed.
              {updateInfo?.version && ` Version ${updateInfo.version}.`}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Reloading state — brief spinner before restart
  if (appState === 'reloading') {
    return (
      <Modal
        transparent
        animationType="fade"
        visible={true}
        presentationStyle="pageSheet"
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.header}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.title}>Installing Update</Text>
            </View>

            <Text style={styles.description}>
              Installing the update and restarting the app. Please wait…
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Default idle state — show the update prompt
  if (!showModal || !updateInfo) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={showModal}
      presentationStyle="pageSheet"
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Icon name="download" size={32} color="#4F46E5" />
            <Text style={styles.title}>Update Available</Text>
          </View>

          <Text style={styles.description}>
            A new version of Money Manager is ready to install.
            {updateInfo.version && ` Version ${updateInfo.version}.`}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton]}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissText}>Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
            >
              <Icon name="download" size={20} color="#FFFFFF" />
              <Text style={styles.updateText}>Update & Restart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1D2E',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  description: {
    fontSize: 15,
    color: '#9CA3AF',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  dismissButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dismissText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    backgroundColor: '#4F46E5',
  },
  updateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
