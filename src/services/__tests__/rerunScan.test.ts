import { Platform } from 'react-native';
import { rerunScanService } from '../rerunScan';
import { notificationDetectionService } from '../notificationDetection';
import { transactionService } from '../index';
import { accountBackfillService } from '../accountBackfill';
import { dataEvents } from '../events';

jest.mock('../notificationDetection', () => ({
  notificationDetectionService: {
    isSmsAccessEnabled: jest.fn(),
    requestSmsAccess: jest.fn(),
    scanSmsInbox: jest.fn(),
  },
}));

jest.mock('../index', () => ({
  transactionService: {
    syncPendingNativeEvents: jest.fn(),
  },
}));

jest.mock('../accountBackfill', () => ({
  accountBackfillService: {
    runAutoBackfill: jest.fn(),
  },
}));

jest.mock('../events', () => ({
  dataEvents: {
    emit: jest.fn(),
  },
}));

describe('rerunScanService.rerunScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });

    (notificationDetectionService.isSmsAccessEnabled as jest.Mock).mockResolvedValue(true);
    (notificationDetectionService.requestSmsAccess as jest.Mock).mockResolvedValue(true);
    (notificationDetectionService.scanSmsInbox as jest.Mock).mockResolvedValue({ scanned: 42, captured: 5 });
    (transactionService.syncPendingNativeEvents as jest.Mock).mockResolvedValue({ created: 2, relinked: 1 });
    (accountBackfillService.runAutoBackfill as jest.Mock).mockResolvedValue({
      linkedCount: 3,
      unconfigured: [],
    });
  });

  it('runs incremental scan with fullScan: false and aggregates metrics', async () => {
    const result = await rerunScanService.rerunScan({ mode: 'incremental' });

    expect(notificationDetectionService.scanSmsInbox).toHaveBeenCalledWith({
      fullScan: false,
      firstScanDays: 7,
    });
    expect(transactionService.syncPendingNativeEvents).toHaveBeenCalledWith({
      skipInboxScan: true,
    });
    expect(accountBackfillService.runAutoBackfill).toHaveBeenCalledWith({ force: true });
    expect(dataEvents.emit).toHaveBeenCalled();

    expect(result).toEqual({
      scanned: 42,
      captured: 2,
      relinked: 4, // 1 from sync + 3 from backfill
      unconfigured: [],
    });
  });

  it('runs complete scan with fullScan: true and passes unconfigured accounts', async () => {
    const unconfigured = [{ bankName: 'SBI', mask: '5678', count: 2 }];
    (accountBackfillService.runAutoBackfill as jest.Mock).mockResolvedValue({
      linkedCount: 0,
      unconfigured,
    });

    const result = await rerunScanService.rerunScan({ mode: 'complete' });

    expect(notificationDetectionService.scanSmsInbox).toHaveBeenCalledWith({
      fullScan: true,
      firstScanDays: 7,
    });
    expect(result.unconfigured).toEqual(unconfigured);
  });

  it('requests SMS access when not enabled, throwing SMS_PERMISSION_DENIED if user rejects', async () => {
    (notificationDetectionService.isSmsAccessEnabled as jest.Mock).mockResolvedValue(false);
    (notificationDetectionService.requestSmsAccess as jest.Mock).mockResolvedValue(false);

    await expect(rerunScanService.rerunScan({ mode: 'incremental' })).rejects.toThrow(
      'SMS_PERMISSION_DENIED'
    );

    expect(notificationDetectionService.requestSmsAccess).toHaveBeenCalled();
    expect(notificationDetectionService.scanSmsInbox).not.toHaveBeenCalled();
  });

  it('requests SMS access when not enabled and proceeds if user grants permission', async () => {
    (notificationDetectionService.isSmsAccessEnabled as jest.Mock).mockResolvedValue(false);
    (notificationDetectionService.requestSmsAccess as jest.Mock).mockResolvedValue(true);

    const result = await rerunScanService.rerunScan({ mode: 'incremental' });

    expect(notificationDetectionService.requestSmsAccess).toHaveBeenCalled();
    expect(notificationDetectionService.scanSmsInbox).toHaveBeenCalled();
    expect(result.scanned).toBe(42);
  });

  it('returns empty result on non-Android platform without error', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

    const result = await rerunScanService.rerunScan({ mode: 'complete' });

    expect(result).toEqual({ scanned: 0, captured: 0, relinked: 0, unconfigured: [] });
    expect(notificationDetectionService.scanSmsInbox).not.toHaveBeenCalled();
  });
});
