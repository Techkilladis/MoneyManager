/**
 * Update Prompt Component
 *
 * Displays an "Update available - restart now?" dialog when an OTA update
 * is detected. Respects the user's update preference setting.
 */

import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, AppState as RNAppState } from 'react-native';
import { checkForUpdates, onUpdateStatusChange, UpdateInfo, UpdateStatus, requestRestart } from '../services/updateChecker';
import { Icon } from '../components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface UpdatePromptProps {
  /** Called when the user dismisses the update prompt without updating */
  onDismiss?: () => void;
}

export function UpdatePrompt({ onDismiss }: UpdatePromptProps) {
  const [showModal, setShowModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Check for updates on mount
    checkForUpdates().then(info => {
      if (info?.available) {
        setUpdateInfo(info);
        setShowModal(true);
      }
    }).catch(console.warn);

    // Listen for status changes
    const unsubscribe = onUpdateStatusChange((newStatus: UpdateStatus) => {
      if (newStatus === 'available') {
        checkForUpdates().then(info => {
          if (info?.available && !showModal) {
            setUpdateInfo(info);
            setShowModal(true);
          }
        }).catch(console.warn);
      }
    });

    // Check again when app comes to foreground
    const listener = (state: string) => {
      if (state === 'active') {
        checkForUpdates().then(info => {
          if (info?.available && !showModal) {
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
  }, [showModal]);

  const handleUpdate = async () => {
    setShowModal(false);
    try {
      await requestRestart();
    } catch (error) {
      console.warn('Failed to restart:', error);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    onDismiss?.();
  };

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
