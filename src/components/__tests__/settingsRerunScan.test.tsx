import React from 'react';
import { Animated, Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import SettingsScreen from '../../../app/(tabs)/settings';
import { RerunScanSheet } from '../RerunScanSheet';
import { ListRow } from '../ui/Surface';
import { freshDatabase } from '../../../test/db';

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void) => {
      react.useEffect(() => {
        return cb();
      }, [cb]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(Animated, 'spring').mockImplementation((value: any, config: any) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback?.({ finished: true });
    },
    stop: () => {},
    reset: () => {},
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(Animated, 'timing').mockImplementation((value: any, config: any) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback?.({ finished: true });
    },
    stop: () => {},
    reset: () => {},
  }));
});

beforeEach(async () => {
  await freshDatabase();
});

describe('Settings Screen - Rerun Scan Integration', () => {
  it('renders "Rerun scan" row on Android and opens RerunScanSheet on press', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<SettingsScreen />);
    });

    const rows = testRenderer!.root.findAllByType(ListRow);
    const rerunRow = rows.find((r) => r.props.title === 'Rerun scan');
    expect(rerunRow).toBeDefined();
    expect(rerunRow!.props.subtitle).toBe(
      'Scan SMS inbox for missed payments or unlinked accounts'
    );

    // Initial sheet is not visible
    let sheet = testRenderer!.root.findByType(RerunScanSheet);
    expect(sheet.props.visible).toBe(false);

    // Press rerun scan row
    await act(async () => {
      rerunRow!.props.onPress();
    });

    sheet = testRenderer!.root.findByType(RerunScanSheet);
    expect(sheet.props.visible).toBe(true);
  });

  it('does not render "Rerun scan" row on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<SettingsScreen />);
    });

    const rows = testRenderer!.root.findAllByType(ListRow);
    const rerunRow = rows.find((r) => r.props.title === 'Rerun scan');
    expect(rerunRow).toBeUndefined();
  });
});
