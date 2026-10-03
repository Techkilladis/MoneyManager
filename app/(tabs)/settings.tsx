// Settings Screen
import React, { useEffect, useState } from 'react';
import { View, Linking, Platform, ScrollView } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  BodyEmphasis, 
  Body, 
  Footnote, 
  Divider,
  DisplayLarge,
  Button,
  Badge
} from '@/design/primitives';
import { services } from '@/services';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const [notificationAccessEnabled, setNotificationAccessEnabled] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const checkNotificationAccess = async () => {
    try {
      const enabled = await services.notification.isNotificationAccessEnabled();
      setNotificationAccessEnabled(enabled);
    } catch (error) {
      console.error('Failed to check notification access:', error);
      setNotificationAccessEnabled(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  const openNotificationAccessSettings = async () => {
    try {
      await services.notification.openNotificationAccessSettings();
    } catch (error) {
      console.error('Failed to open notification access settings:', error);
      // Fallback to general settings
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

  useEffect(() => {
    checkNotificationAccess();
  }, []);

  const version = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Section paddedHorizontal style={{ paddingTop: 8, paddingBottom: 4 }}>
          <DisplayLarge style={{ letterSpacing: -0.8 }}>Settings</DisplayLarge>
        </Section>

        {/* Data Section */}
        <Section paddedHorizontal>
          <Card>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Data & Storage</BodyEmphasis>
              <Footnote color="rgba(0,0,0,0.38)">Local only</Footnote>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <View style={{ flex: 1 }}>
                <BodyEmphasis>Local Database</BodyEmphasis>
                <Footnote color="rgba(0,0,0,0.38)" style={{ marginTop: 2 }}>
                  SQLite database stored on device
                </Footnote>
              </View>
              <Badge variant="success" size="small">Active</Badge>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <View style={{ flex: 1 }}>
                <BodyEmphasis>Data Export</BodyEmphasis>
                <Footnote color="rgba(0,0,0,0.38)" style={{ marginTop: 2 }}>
                  Export your financial data
                </Footnote>
              </View>
              <Button variant="ghost" size="small" onPress={() => alert('Export coming soon')}>
                Export
              </Button>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <View style={{ flex: 1 }}>
                <BodyEmphasis>Clear All Data</BodyEmphasis>
                <Footnote color="rgba(0,0,0,0.38)" style={{ marginTop: 2 }}>
                  Permanently delete all transactions
                </Footnote>
              </View>
              <Button variant="destructive" size="small" onPress={() => alert('Clear data coming soon')}>
                Clear
              </Button>
            </Row>
          </Card>
        </Section>

        {/* Permissions Section */}
        <Section paddedHorizontal style={{ marginTop: 8 }}>
          <Card>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Permissions</BodyEmphasis>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <View style={{ flex: 1 }}>
                <BodyEmphasis>UPI Notification Access</BodyEmphasis>
                <Footnote color="rgba(0,0,0,0.38)" style={{ marginTop: 2 }}>
                  Required to automatically detect UPI payments
                </Footnote>
              </View>
              <Button 
                variant={notificationAccessEnabled ? "secondary" : "primary"} 
                size="small" 
                onPress={openNotificationAccessSettings}
                disabled={checkingAccess}
              >
                {notificationAccessEnabled ? 'Enabled' : 'Enable Access'}
              </Button>
            </Row>
            <Divider inset />
            <Row style={{ paddingVertical: 14 }}>
              <View style={{ flex: 1 }}>
                <BodyEmphasis>Current Status</BodyEmphasis>
                <Footnote color="rgba(0,0,0,0.38)" style={{ marginTop: 2 }}>
                  {checkingAccess ? 'Checking...' : notificationAccessEnabled ? 'Notification access is enabled' : 'Notification access is disabled. Tap "Enable Access" to grant permission.'}
                </Footnote>
              </View>
            </Row>
          </Card>
        </Section>

        {/* App Section */}
        <Section paddedHorizontal style={{ marginTop: 8 }}>
          <Card>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>App</BodyEmphasis>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Version</BodyEmphasis>
              <Footnote color="rgba(0,0,0,0.38)">{version} (Build {buildNumber})</Footnote>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Platform</BodyEmphasis>
              <Footnote color="rgba(0,0,0,0.38)">{Platform.OS === 'android' ? 'Android' : 'iOS'}</Footnote>
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Expo SDK</BodyEmphasis>
              <Footnote color="rgba(0,0,0,0.38)">52</Footnote>
            </Row>
          </Card>
        </Section>

        {/* Privacy Section */}
        <Section paddedHorizontal style={{ marginTop: 8 }}>
          <Card>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Privacy</BodyEmphasis>
            </Row>
            <Divider inset />
            <View style={{ paddingVertical: 14 }}>
              <Body color="rgba(0,0,0,0.54)" style={{ lineHeight: 22 }}>
                Money Manager is a local-first application. Your financial data never leaves your device. 
                No cloud backup, no analytics, no tracking. All transactions, categories, and members 
                are stored locally in an encrypted SQLite database.
              </Body>
            </View>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Delete Account & Data</BodyEmphasis>
              <Button variant="destructive" size="small" onPress={() => alert('Delete account coming soon')}>
                Delete
              </Button>
            </Row>
          </Card>
        </Section>

        {/* About Section */}
        <Section paddedHorizontal style={{ marginTop: 8, paddingBottom: 24 }}>
          <Card>
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <BodyEmphasis style={{ marginBottom: 4 }}>Money Manager</BodyEmphasis>
              <Footnote color="rgba(0,0,0,0.38)">
                Privacy-first personal finance for Android
              </Footnote>
            </View>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}