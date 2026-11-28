import React from 'react';
import { Animated, Platform, Text as RNText } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import AccountsScreen from '../../../app/accounts';
import { RerunScanSheet } from '../RerunScanSheet';
import { Button } from '../ui';
import { ListRow } from '../ui/Surface';
import { addTx, freshDatabase } from '../../../test/db';
import { accountRepository } from '@/database/repositories/accountRepository';
import { notificationDetectionService } from '@/services/notificationDetection';
import { setSetting } from '@/services/settings';

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

describe('Accounts Screen - Rerun Scan Integration', () => {
  it('renders "Rerun scan" button on Android and opens RerunScanSheet on press', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<AccountsScreen />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const buttons = testRenderer!.root.findAllByType(Button);
    const rerunButton = buttons.find((b) => b.props.title === 'Rerun scan');
    expect(rerunButton).toBeDefined();

    let sheet = testRenderer!.root.findByType(RerunScanSheet);
    expect(sheet.props.visible).toBe(false);

    await act(async () => {
      rerunButton!.props.onPress();
    });

    sheet = testRenderer!.root.findByType(RerunScanSheet);
    expect(sheet.props.visible).toBe(true);
  });

  it('does not render "Rerun scan" button on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<AccountsScreen />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const buttons = testRenderer!.root.findAllByType(Button);
    const rerunButton = buttons.find((b) => b.props.title === 'Rerun scan');
    expect(rerunButton).toBeUndefined();
  });

  it('updates per-account linked entry counts and spend totals inside AccountsScreen after Rerun scan', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    const now = Date.now();
    const icici = await accountRepository.create({
      name: 'ICICI',
      bankName: 'ICICI Bank',
      mask: '172',
      type: 'SAVINGS',
    });
    await accountRepository.create({
      name: 'Indian Bank',
      bankName: 'Indian Bank',
      mask: '1224',
      type: 'SAVINGS',
    });

    await addTx({ amountPaise: 50000, merchant: 'Swiggy', at: now - 30000, accountId: icici.id });
    await addTx({
      amountPaise: 7000,
      merchant: 'Velan Fruit',
      at: now - 10000,
      accountId: 'account-cash',
      sourceType: 'UPI_NOTIFICATION',
      sourceEventId: 'ev-indian-1',
    });
    await setSetting('hasRunAccountBackfill', true);

    const smsSpy = jest.spyOn(notificationDetectionService, 'isSmsAccessEnabled').mockResolvedValue(true);
    const initSpy = jest.spyOn(notificationDetectionService, 'initialize').mockResolvedValue(true);
    const scanSpy = jest.spyOn(notificationDetectionService, 'scanSmsInbox').mockResolvedValue({ scanned: 10, captured: 0 });
    const pendingSpy = jest.spyOn(notificationDetectionService, 'getPendingUpiEvents').mockResolvedValue([]);
    const allSpy = jest
      .spyOn(notificationDetectionService, 'getAllPendingUpiEvents')
      .mockResolvedValueOnce([
        {
          id: 'ev-indian-1',
          amountPaise: 7000,
          merchant: 'Velan Fruit',
          sourceApp: 'BANK_SMS',
          transactionTimestamp: now - 10000,
          parserName: 'BankSmsParser',
          confidence: 0.9,
          notificationId: 'sms-1',
          status: 'CONSUMED',
          createdAt: now - 10000,
          dedupeKey: 'dk-1',
          direction: 'DEBIT',
          accountMask: null,
          bankName: null,
        },
      ])
      .mockResolvedValue([
        {
          id: 'ev-indian-1',
          amountPaise: 7000,
          merchant: 'Velan Fruit',
          sourceApp: 'BANK_SMS',
          transactionTimestamp: now - 10000,
          parserName: 'BankSmsParser',
          confidence: 0.9,
          notificationId: 'sms-1',
          status: 'CONSUMED',
          createdAt: now - 10000,
          dedupeKey: 'dk-1',
          direction: 'DEBIT',
          accountMask: '1224',
          bankName: 'Indian Bank',
        },
      ]);

    try {
      let testRenderer: renderer.ReactTestRenderer | undefined;
      await act(async () => {
        testRenderer = renderer.create(<AccountsScreen />);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      });

      const textBefore = testRenderer!.root
        .findAllByType(RNText)
        .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
        .join(' | ');
      expect(textBefore).toContain('No entries linked yet');

      const rerunButton = testRenderer!.root.findAllByType(Button).find((b) => b.props.title === 'Rerun scan');
      await act(async () => {
        rerunButton!.props.onPress();
      });
      const sheet = testRenderer!.root.findByType(RerunScanSheet);
      const completeRow = sheet.findAllByType(ListRow).find((r) => r.props.title === 'Complete scan');
      await act(async () => {
        completeRow!.props.onPress();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      });

      const textAfter = testRenderer!.root
        .findAllByType(RNText)
        .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
        .join(' | ');
      expect(textAfter).toContain('1 entry · ₹70 spent');
      expect(textAfter).toContain('1 entry · ₹500 spent');
    } finally {
      smsSpy.mockRestore();
      initSpy.mockRestore();
      scanSpy.mockRestore();
      pendingSpy.mockRestore();
      allSpy.mockRestore();
    }
  });
});
