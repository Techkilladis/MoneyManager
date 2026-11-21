import React from 'react';
import { Animated } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { AccountDiscoveryModal } from '../AccountDiscoveryModal';
import { accountService } from '@/services';
import { Button } from '../ui';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../ui/Toast', () => ({
  useToast: () => ({
    show: jest.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockCompleteBackfill = jest.fn();

jest.mock('@/services', () => ({
  accountService: {
    create: jest.fn().mockResolvedValue({
      id: 'acc-new-1',
      name: 'HDFC Bank',
      bankName: 'HDFC Bank',
      mask: '4321',
      type: 'SAVINGS',
    }),
  },
  transactionService: {
    assignAccountToPending: jest.fn(),
  },
  accountBackfillService: {
    completeBackfillForAccount: (...args: any[]) => mockCompleteBackfill(...args),
  },
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

describe('AccountDiscoveryModal', () => {
  it('calls accountBackfillService.completeBackfillForAccount on save when mask is present', async () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <AccountDiscoveryModal
          visible={true}
          initialData={{ bankName: 'HDFC Bank', mask: '4321' }}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    });

    const buttons = testRenderer!.root.findAllByType(Button);
    const saveButton = buttons.find((b) => b.props.title === 'Save account');
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton!.props.onPress();
    });

    expect(accountService.create).toHaveBeenCalled();
    expect(mockCompleteBackfill).toHaveBeenCalledWith(
      'HDFC Bank',
      '4321',
      'acc-new-1'
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
