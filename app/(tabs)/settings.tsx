// Settings Screen - Premium Settings Experience
import React, { useEffect, useState } from 'react';
import { View, Linking, Platform, ScrollView, StyleSheet } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  Column,
  BodyEmphasis, 
  Body, 
  Footnote, 
  Divider,
  DisplayLarge,
  Button,
  Badge,
  Title1,
  Title2,
  Subhead,
  Caption1,
  Caption2,
  Micro,
  Switch,
  Input,
  Avatar,
  ListItem,
  SectionHeader,
  TextPrimitive,
} from '@/design/primitives';
import { services } from '@/services';
import Constants from 'expo-constants';
import { colors, spacing, radius, shadows, typography } from '@/design/tokens';

export default function SettingsScreen() {
  const [notificationAccessEnabled, setNotificationAccessEnabled] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Check notification access status on mount. setState happens only inside
  // promise callbacks (never synchronously in the effect body), and results
  // are ignored after unmount.
  useEffect(() => {
    let active = true;

    services.notification.isNotificationAccessEnabled()
      .then((enabled) => {
        if (!active) return;
        setNotificationAccessEnabled(enabled);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to check notification access:', error);
        setNotificationAccessEnabled(false);
      })
      .finally(() => {
        if (!active) return;
        setCheckingAccess(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openNotificationAccessSettings = async () => {
    try {
      await services.notification.openNotificationAccessSettings();
    } catch (error) {
      console.error('Failed to open notification access settings:', error);
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      }
    }
  };

  const openAppSettings = async () => {
    try {
      await Linking.openURL('app-settings:');
    } catch (e) {
      console.error('Failed to open app settings:', e);
    }
  };

  const version = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[20] }}>
        {/* Header */}
        <Section paddedHorizontal style={{ paddingTop: spacing[4], paddingBottom: spacing[2] }}>
          <Row justify="space-between" align="center">
            <Title1 style={{ letterSpacing: typography.letterSpacing.display }}>Settings</Title1>
            <Button variant="ghost" size="small" onPress={() => setShowAdvanced(!showAdvanced)}>
              <TextPrimitive variant="micro">{showAdvanced ? '▲' : '▼'}</TextPrimitive>
              <TextPrimitive variant="micro">{showAdvanced ? 'Hide' : 'Show'} Advanced</TextPrimitive>
            </Button>
          </Row>
        </Section>

        {/* Notification Access Section */}
        <Section paddedHorizontal>
          <Card variant="elevated">
            <SectionHeader 
              title="UPI Notification Access" 
              subtitle="Automatically detect UPI payments from notifications"
              action={{ 
                label: notificationAccessEnabled ? 'Disable' : 'Enable', 
                onPress: openNotificationAccessSettings 
              }}
            />
            <Divider inset />
            <ListItem
              leftElement={<Badge variant="indigo" size="small" dot><Micro>UPI</Micro></Badge>}
              onPress={openNotificationAccessSettings}
            >
              <Column gap={spacing[1]}>
                <BodyEmphasis>UPI Notification Access</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>
                  {checkingAccess 
                    ? 'Checking status…' 
                    : notificationAccessEnabled 
                      ? 'Enabled — Your app can read UPI payment notifications' 
                      : 'Disabled — Tap to grant permission in system settings'}
                </Caption1>
              </Column>
              <Switch
                value={notificationAccessEnabled}
                onValueChange={async (value) => {
                  if (value && !notificationAccessEnabled) {
                    await openNotificationAccessSettings();
                  } else if (!value && notificationAccessEnabled) {
                    await openNotificationAccessSettings();
                  }
                }}
                disabled={checkingAccess}
              />
            </ListItem>
            {!checkingAccess && !notificationAccessEnabled && (
              <View style={{ marginTop: spacing[2], paddingHorizontal: spacing[16] }}>
                <Caption2 color={colors.textQuaternary} style={{ textAlign: 'center' }}>
                  When enabled, Money Manager will automatically detect UPI payments from Google Pay, PhonePe, Paytm, BHIM and other UPI apps
                </Caption2>
              </View>
            )}
          </Card>
        </Section>

        {/* Data & Storage Section */}
        <Section paddedHorizontal style={{ marginTop: spacing[4] }}>
          <Card variant="elevated">
            <SectionHeader title="Data & Storage" subtitle="Local-first, privacy-focused" />
            <Divider inset />
            <ListItem
              leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                <TextPrimitive variant="title2" color={colors.accent}>💾</TextPrimitive>
              </View>}
            >
              <Column gap={spacing[1]}>
                <BodyEmphasis>Local Database</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>SQLite database stored securely on your device</Caption1>
              </Column>
              <Badge variant="success" size="small">Active</Badge>
            </ListItem>
            <Divider inset />
            <ListItem
              leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.successBackground, justifyContent: 'center', alignItems: 'center' }}>
                <TextPrimitive variant="title2" color={colors.success}>📤</TextPrimitive>
              </View>}
              onPress={() => alert('Export feature coming soon')}
            >
              <Column gap={spacing[1]}>
                <BodyEmphasis>Export Data</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>Download your financial data as CSV or JSON</Caption1>
              </Column>
              <Button variant="ghost" size="small">Export</Button>
            </ListItem>
            <Divider inset />
            <ListItem
              leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.errorBackground, justifyContent: 'center', alignItems: 'center' }}>
                <TextPrimitive variant="title2" color={colors.error}>🗑️</TextPrimitive>
              </View>}
              onPress={() => alert('Clear all data coming soon')}
            >
              <Column gap={spacing[1]}>
                <BodyEmphasis>Clear All Data</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>Permanently delete all transactions, categories, and members</Caption1>
              </Column>
              <Button variant="destructive" size="small">Clear</Button>
            </ListItem>
          </Card>
        </Section>

        {/* App Info Section */}
        <Section paddedHorizontal style={{ marginTop: spacing[4] }}>
          <Card variant="elevated">
            <SectionHeader title="App" />
            <Divider inset />
            <ListItem>
              <Column gap={spacing[1]}>
                <BodyEmphasis>Version</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>{version} (Build {buildNumber})</Caption1>
              </Column>
            </ListItem>
            <Divider inset />
            <ListItem>
              <Column gap={spacing[1]}>
                <BodyEmphasis>Platform</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>{Platform.OS === 'android' ? 'Android' : 'iOS'}</Caption1>
              </Column>
            </ListItem>
            <Divider inset />
            <ListItem>
              <Column gap={spacing[1]}>
                <BodyEmphasis>Expo SDK</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>52</Caption1>
              </Column>
            </ListItem>
            <Divider inset />
            <ListItem>
              <Column gap={spacing[1]}>
                <BodyEmphasis>React Native</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>0.76.9</Caption1>
              </Column>
            </ListItem>
            <Divider inset />
            <ListItem>
              <Column gap={spacing[1]}>
                <BodyEmphasis>Architecture</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>Expo Router + Expo SQLite + Native Kotlin Module</Caption1>
              </Column>
            </ListItem>
          </Card>
        </Section>

        {/* Privacy Section */}
        <Section paddedHorizontal style={{ marginTop: spacing[4] }}>
          <Card variant="elevated">
            <SectionHeader title="Privacy & Security" />
            <Divider inset />
            <View style={{ paddingVertical: spacing[2], paddingHorizontal: spacing[16] }}>
              <Body color={colors.textSecondary} style={{ lineHeight: typography.lineHeight.normal }}>
                Money Manager is a local-first application. Your financial data never leaves your device. 
                No cloud backup, no analytics, no tracking. All transactions, categories, and members 
                are stored locally in an encrypted SQLite database.
              </Body>
            </View>
            <Divider inset />
            <ListItem
              leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.errorBackground, justifyContent: 'center', alignItems: 'center' }}>
                <TextPrimitive variant="title2" color={colors.error}>🗑️</TextPrimitive>
              </View>}
              onPress={() => alert('Delete account feature coming soon')}
            >
              <Column gap={spacing[1]}>
                <BodyEmphasis>Delete All Data</BodyEmphasis>
                <Caption1 color={colors.textTertiary}>Permanently erase all financial data and reset the app</Caption1>
              </Column>
              <Button variant="destructive" size="small">Delete</Button>
            </ListItem>
          </Card>
        </Section>

        {/* Advanced Settings (Conditional) */}
        {showAdvanced && (
          <Section paddedHorizontal style={{ marginTop: spacing[4] }}>
            <Card variant="elevated">
              <SectionHeader 
                title="Advanced" 
                subtitle="Developer and power-user options"
                action={{ label: 'Hide', onPress: () => setShowAdvanced(false) }}
              />
              <Divider inset />
              <ListItem
                leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
                  <TextPrimitive variant="title2" color={colors.accent}>🐛</TextPrimitive>
                </View>}
                onPress={() => {
                  const { notification } = services;
                  notification.getParsingStats().then(stats => {
                    alert(`Parsing Stats:\nTotal Events: ${stats.total}\nBy Source: ${JSON.stringify(stats.bySource)}\nBy Parser: ${JSON.stringify(stats.byParser)}`);
                  });
                }}
              >
                <Column gap={spacing[1]}>
                  <BodyEmphasis>Notification Parsing Stats</BodyEmphasis>
                  <Caption1 color={colors.textTertiary}>View detection statistics and parser performance</Caption1>
                </Column>
                <Button variant="ghost" size="small">View Stats</Button>
              </ListItem>
              <Divider inset />
              <ListItem
                leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.accentLightDark, justifyContent: 'center', alignItems: 'center' }}>
                  <TextPrimitive variant="title2" color={colors.accentIndigo}>🧪</TextPrimitive>
                </View>}
                onPress={() => alert('Simulate UPI notification for testing')}
              >
                <Column gap={spacing[1]}>
                  <BodyEmphasis>Simulate UPI Notification</BodyEmphasis>
                  <Caption1 color={colors.textTertiary}>Test the notification detection pipeline</Caption1>
                </Column>
                <Button variant="ghost" size="small">Simulate</Button>
              </ListItem>
              <Divider inset />
              <ListItem
                leftElement={<View style={{ width: 40, height: 40, borderRadius: radius.circle, backgroundColor: colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' }}>
                  <TextPrimitive variant="title2" color={colors.textSecondary}>📱</TextPrimitive>
                </View>}
                onPress={openAppSettings}
              >
                <Column gap={spacing[1]}>
                  <BodyEmphasis>App Settings</BodyEmphasis>
                  <Caption1 color={colors.textTertiary}>Open system app settings (permissions, storage, etc.)</Caption1>
                </Column>
                <Button variant="ghost" size="small">Open</Button>
              </ListItem>
            </Card>
          </Section>
        )}

        {/* About Section */}
        <Section paddedHorizontal style={{ marginTop: spacing[4], paddingBottom: spacing[16] }}>
          <Card variant="subtle">
            <View style={{ paddingVertical: spacing[4], alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] }}>
                <TextPrimitive variant="displaySmall" color={colors.accent}>💰</TextPrimitive>
              </View>
              <Title2 style={{ marginBottom: spacing[1] }}>Money Manager</Title2>
              <Subhead color={colors.textTertiary}>
                Privacy-first personal finance for Android
              </Subhead>
              <Divider style={{ marginVertical: spacing[4], opacity: 0.5 }} />
              <Caption1 color={colors.textTertiary} style={{ textAlign: 'center' }}>
                Version {version} • Build {buildNumber} • Expo SDK 52
              </Caption1>
              <Caption2 color={colors.textQuaternary} style={{ marginTop: spacing[1], textAlign: 'center' }}>
                Built with Expo Router, Expo SQLite, and Native Kotlin
              </Caption2>
            </View>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}