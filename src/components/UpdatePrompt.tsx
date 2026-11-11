import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { makeStyles, useTheme } from '@/design/theme';
import { Button, Card, IconName, IconTile, StatusChip, Text } from '@/components/ui';
import { radius, space } from '@/design/tokens';
import { checkForUpdates, UpdateCheckResult } from '@/services/updateService';

export interface UpdatePromptProps {
  /**
   * Delay in milliseconds before initiating the update check on mount.
   * Defaults to 2000 ms to avoid competing with initial screen paint.
   */
  checkDelayMs?: number;
  /** Custom update check function (defaults to updateService.checkForUpdates). */
  checkForUpdatesFn?: () => Promise<UpdateCheckResult>;
  /** Custom OTA bundle fetch function (defaults to Updates.fetchUpdateAsync). */
  fetchUpdateFn?: () => Promise<Updates.UpdateFetchResult>;
  /** Custom app reload function (defaults to Updates.reloadAsync). */
  reloadFn?: () => Promise<void>;
  /** Custom URL opener for downloading APK (defaults to Linking.openURL). */
  openUrlFn?: (url: string) => Promise<unknown>;
}

type PromptState =
  | { type: 'idle' }
  | { type: 'native'; descriptor: Extract<UpdateCheckResult, { type: 'native' }> }
  | { type: 'ota-available'; descriptor: Extract<UpdateCheckResult, { type: 'ota' }> }
  | { type: 'ota-downloading' }
  | { type: 'ota-ready' };

interface PromptContentProps {
  icon: IconName;
  title: string;
  badge?: string;
  description: string;
  primaryTitle: string;
  primaryIcon?: IconName;
  onPrimary: () => void;
  secondaryTitle: string;
  onSecondary: () => void;
}

/**
 * Unified update prompt modal component.
 *
 * Checks for updates on mount after an initial delay and presents:
 * - Native Update modal when a newer native APK is available on GitHub Releases.
 * - Two-Stage OTA modal when an Over-The-Air runtime update is ready.
 *
 * Adheres strictly to the Paper & Ink editorial design system.
 */
export function UpdatePrompt({
  checkDelayMs = 2000,
  checkForUpdatesFn = checkForUpdates,
  fetchUpdateFn = () => Updates.fetchUpdateAsync(),
  reloadFn = () => Updates.reloadAsync(),
  openUrlFn = (url: string) => Linking.openURL(url),
}: UpdatePromptProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [promptState, setPromptState] = useState<PromptState>({ type: 'idle' });

  useEffect(() => {
    let active = true;

    const executeCheck = () => {
      checkForUpdatesFn()
        .then((result) => {
          if (!active) return;
          if (result.type === 'native') {
            setPromptState({ type: 'native', descriptor: result });
          } else if (result.type === 'ota') {
            setPromptState({ type: 'ota-available', descriptor: result });
          } else {
            setPromptState({ type: 'idle' });
          }
        })
        .catch(() => {
          if (active) {
            setPromptState({ type: 'idle' });
          }
        });
    };

    if (checkDelayMs <= 0) {
      executeCheck();
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(executeCheck, checkDelayMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkForUpdatesFn, checkDelayMs]);

  const handleDismiss = useCallback(() => {
    setPromptState({ type: 'idle' });
  }, []);

  const handleNativeDownload = useCallback(() => {
    if (promptState.type !== 'native') return;
    const downloadUrl = promptState.descriptor.downloadUrl;
    // Dismiss the prompt immediately so user is returned to the app while Chrome downloads in background
    setPromptState({ type: 'idle' });
    void openUrlFn(downloadUrl).catch(() => undefined);
  }, [promptState, openUrlFn]);

  const handleStartOtaUpdate = useCallback(async () => {
    setPromptState({ type: 'ota-downloading' });
    try {
      const result = await fetchUpdateFn();
      if (result && result.isNew) {
        setPromptState({ type: 'ota-ready' });
      } else {
        setPromptState({ type: 'idle' });
      }
    } catch {
      // Fetch failed — dismiss modal silently
      setPromptState({ type: 'idle' });
    }
  }, [fetchUpdateFn]);

  const handleRestartNow = useCallback(async () => {
    try {
      await reloadFn();
    } catch {
      setPromptState({ type: 'idle' });
    }
  }, [reloadFn]);

  if (promptState.type === 'idle') {
    return null;
  }

  const isDownloading = promptState.type === 'ota-downloading';

  const renderContent = () => {
    if (promptState.type === 'native') {
      const versionTag = promptState.descriptor.latestVersion.startsWith('v')
        ? promptState.descriptor.latestVersion
        : `v${promptState.descriptor.latestVersion}`;

      return (
        <PromptContent
          icon="download"
          title="New App Version Available"
          badge={versionTag}
          description="A new version of Money Manager is ready. Download the latest APK to get the newest features and improvements."
          primaryTitle="Download"
          primaryIcon="download"
          onPrimary={handleNativeDownload}
          secondaryTitle="Later"
          onSecondary={handleDismiss}
        />
      );
    }

    if (promptState.type === 'ota-available') {
      return (
        <PromptContent
          icon="sparkles"
          title="Update available"
          description="A new version is ready. Update now to get the latest improvements and bug fixes."
          primaryTitle="Update now"
          onPrimary={handleStartOtaUpdate}
          secondaryTitle="Later"
          onSecondary={handleDismiss}
        />
      );
    }

    if (promptState.type === 'ota-ready') {
      return (
        <PromptContent
          icon="refresh"
          title="Update ready"
          description="Restart now to apply changes?"
          primaryTitle="Restart now"
          primaryIcon="refresh"
          onPrimary={handleRestartNow}
          secondaryTitle="Restart later"
          onSecondary={handleDismiss}
        />
      );
    }

    // ota-downloading
    return (
      <View style={styles.downloadingContainer}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text variant="heading" align="center" style={styles.downloadingTitle}>
          Downloading update...
        </Text>
        <Text variant="body" align="center" style={styles.downloadingSubtitle}>
          Please do not close the app
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={isDownloading ? () => {} : handleDismiss}
    >
      <View style={styles.overlay}>
        <Card padded style={styles.card}>
          {renderContent()}
        </Card>
      </View>
    </Modal>
  );
}

function PromptContent({
  icon,
  title,
  badge,
  description,
  primaryTitle,
  primaryIcon,
  onPrimary,
  secondaryTitle,
  onSecondary,
}: PromptContentProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <>
      <View style={styles.header}>
        <IconTile icon={icon} color={colors.brand} />
        <View style={styles.headerTitleGroup}>
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
          {badge ? (
            <View style={styles.chipWrapper}>
              <StatusChip label={badge} tone="good" icon="sparkles" />
            </View>
          ) : null}
        </View>
      </View>

      <Text variant="body" style={styles.description}>
        {description}
      </Text>

      <View style={styles.actions}>
        <Button
          title={primaryTitle}
          icon={primaryIcon}
          onPress={onPrimary}
          style={styles.actionButton}
        />
        <Button
          title={secondaryTitle}
          variant="ghost"
          onPress={onSecondary}
          style={styles.secondaryButton}
        />
      </View>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderColor: colors.border,
    borderWidth: 1,
    padding: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    color: colors.text,
  },
  chipWrapper: {
    marginTop: space.xxs,
    alignSelf: 'flex-start',
  },
  description: {
    marginBottom: space.lg,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  actionButton: {
    flex: 1,
  },
  secondaryButton: {
    minWidth: 80,
  },
  downloadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xl,
  },
  downloadingTitle: {
    marginTop: space.lg,
    color: colors.text,
  },
  downloadingSubtitle: {
    marginTop: space.xs,
    color: colors.textSecondary,
  },
}));
