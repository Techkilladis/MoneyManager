/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

const mockScanSmsInbox = jest.fn();

jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {
    ...actual,
    requireOptionalNativeModule: (name: string) => {
      if (name === 'MoneyManagerNotificationDetection') {
        return {
          initialize: jest.fn().mockResolvedValue({ success: true }),
          scanSmsInbox: mockScanSmsInbox,
        };
      }
      return actual.requireOptionalNativeModule(name);
    },
  };
});

describe('notificationDetectionService.scanSmsInbox', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let notificationDetectionService: any;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    // Require service after mocking Platform.OS
    const mod = require('../notificationDetection');
    notificationDetectionService = mod.notificationDetectionService;
  });

  beforeEach(() => {
    mockScanSmsInbox.mockReset();
    mockScanSmsInbox.mockResolvedValue({ scanned: 5, captured: 1 });
  });

  it('defaults to days = 7, fullScan = false with no arguments', async () => {
    const result = await notificationDetectionService.scanSmsInbox();
    expect(mockScanSmsInbox).toHaveBeenCalledWith(7, false);
    expect(result).toEqual({ scanned: 5, captured: 1 });
  });

  it('calls native module with number arguments (e.g. 14, false)', async () => {
    await notificationDetectionService.scanSmsInbox(14);
    expect(mockScanSmsInbox).toHaveBeenCalledWith(14, false);
  });

  it('calls native module with options { fullScan: true } defaulting days to 7', async () => {
    await notificationDetectionService.scanSmsInbox({ fullScan: true });
    expect(mockScanSmsInbox).toHaveBeenCalledWith(7, true);
  });

  it('calls native module with options { firstScanDays: 30, fullScan: true }', async () => {
    await notificationDetectionService.scanSmsInbox({ firstScanDays: 30, fullScan: true });
    expect(mockScanSmsInbox).toHaveBeenCalledWith(30, true);
  });
});
