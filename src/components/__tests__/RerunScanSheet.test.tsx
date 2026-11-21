import React from 'react';
import { Alert, Animated, Text as RNText } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { RerunScanSheet } from '../RerunScanSheet';
import { AccountDiscoveryModal } from '../AccountDiscoveryModal';
import { rerunScanService } from '@/services/rerunScan';
import { ListRow } from '../ui/Surface';

const mockToastShow = jest.fn();
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../ui/Toast', () => ({
  useToast: () => ({
    show: mockToastShow,
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/services/rerunScan', () => ({
  rerunScanService: {
    rerunScan: jest.fn(),
  },
}));

jest.mock('@/utils/haptics', () => ({
  haptic: {
    success: jest.fn(),
    select: jest.fn(),
    impact: jest.fn(),
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

describe('RerunScanSheet', () => {
  const onClose = jest.fn();
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Incremental scan and Complete scan options when visible', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <RerunScanSheet visible={true} onClose={onClose} onComplete={onComplete} />
      );
    });

    const root = testRenderer!.root;
    const textNodes = root.findAllByType(RNText);
    const allText = textNodes.map((n) => n.props.children).flat().join(' ');

    expect(allText).toContain('Incremental scan');
    expect(allText).toContain('Complete scan');
    expect(allText).toContain('Scan recent SMS messages since last scan');
    expect(allText).toContain('Deep scan of inbox messages to recover missed history');
  });

  it('dispatches Incremental scan when incremental row is pressed', async () => {
    (rerunScanService.rerunScan as jest.Mock).mockResolvedValue({
      scanned: 10,
      captured: 1,
      relinked: 2,
      unconfigured: [],
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <RerunScanSheet visible={true} onClose={onClose} onComplete={onComplete} />
      );
    });

    const rows = testRenderer!.root.findAllByType(ListRow);
    const incrementalRow = rows.find((r) => r.props.title === 'Incremental scan');
    expect(incrementalRow).toBeDefined();

    await act(async () => {
      incrementalRow!.props.onPress();
    });

    expect(rerunScanService.rerunScan).toHaveBeenCalledWith({ mode: 'incremental' });
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.stringContaining('1 new payment found, 2 transactions linked')
    );
    expect(onComplete).toHaveBeenCalledWith({
      scanned: 10,
      captured: 1,
      relinked: 2,
      unconfigured: [],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('dispatches Complete scan when complete row is pressed and shows empty summary when no payments found', async () => {
    (rerunScanService.rerunScan as jest.Mock).mockResolvedValue({
      scanned: 100,
      captured: 0,
      relinked: 0,
      unconfigured: [],
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <RerunScanSheet visible={true} onClose={onClose} onComplete={onComplete} />
      );
    });

    const rows = testRenderer!.root.findAllByType(ListRow);
    const completeRow = rows.find((r) => r.props.title === 'Complete scan');
    expect(completeRow).toBeDefined();

    await act(async () => {
      completeRow!.props.onPress();
    });

    expect(rerunScanService.rerunScan).toHaveBeenCalledWith({ mode: 'complete' });
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.stringContaining('No new payments found')
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('hands off to AccountDiscoveryModal when unconfigured accounts are returned', async () => {
    const unconfigured = [{ bankName: 'SBI', mask: '5544', count: 1 }];
    (rerunScanService.rerunScan as jest.Mock).mockResolvedValue({
      scanned: 50,
      captured: 0,
      relinked: 0,
      unconfigured,
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <RerunScanSheet visible={true} onClose={onClose} onComplete={onComplete} />
      );
    });

    const rows = testRenderer!.root.findAllByType(ListRow);
    const incrementalRow = rows.find((r) => r.props.title === 'Incremental scan');

    await act(async () => {
      incrementalRow!.props.onPress();
    });

    // onClose should not be called immediately because discovery modal is shown
    expect(onClose).not.toHaveBeenCalled();
    // Modal with SBI bank details should be rendered
    const discoveryModal = testRenderer!.root.findByType(AccountDiscoveryModal);
    expect(discoveryModal.props.visible).toBe(true);
    expect(discoveryModal.props.initialData).toEqual({ bankName: 'SBI', mask: '5544' });
  });

  it('displays permission alert when SMS_PERMISSION_DENIED error occurs', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (rerunScanService.rerunScan as jest.Mock).mockRejectedValue(
      new Error('SMS_PERMISSION_DENIED')
    );

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <RerunScanSheet visible={true} onClose={onClose} onComplete={onComplete} />
      );
    });

    const rows = testRenderer!.root.findAllByType(ListRow);
    const incrementalRow = rows.find((r) => r.props.title === 'Incremental scan');

    await act(async () => {
      incrementalRow!.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Permission Required',
      'SMS access is needed to scan your inbox for bank transactions.'
    );
    alertSpy.mockRestore();
  });
});
