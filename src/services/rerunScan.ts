import { Platform } from 'react-native';
import { notificationDetectionService } from './notificationDetection';
import { transactionService } from './index';
import { accountBackfillService, DiscoveredAccount } from './accountBackfill';
import { dataEvents } from './events';

export type RerunScanMode = 'incremental' | 'complete';

export interface RerunScanResult {
  scanned: number;
  captured: number;
  relinked: number;
  unconfigured: DiscoveredAccount[];
}

export interface RerunScanOptions {
  mode: RerunScanMode;
}

export const rerunScanService = {
  async rerunScan(options: RerunScanOptions): Promise<RerunScanResult> {
    if (Platform.OS !== 'android') {
      return { scanned: 0, captured: 0, relinked: 0, unconfigured: [] };
    }

    // 1. Permission check
    const hasPermission = await notificationDetectionService.isSmsAccessEnabled();
    if (!hasPermission) {
      const granted = await notificationDetectionService.requestSmsAccess();
      if (!granted) {
        throw new Error('SMS_PERMISSION_DENIED');
      }
    }

    // 2. Trigger native SMS scan
    const isComplete = options.mode === 'complete';
    const scanResult = await notificationDetectionService.scanSmsInbox({
      fullScan: isComplete,
      firstScanDays: 7,
    });

    // 3. Sync native pending events into SQLite
    const syncResult = await transactionService.syncPendingNativeEvents();

    // 4. Run historical account backfill
    const backfillResult = await accountBackfillService.runAutoBackfill({ force: true });

    // 5. Aggregate metrics
    const totalRelinked = (syncResult.relinked ?? 0) + backfillResult.linkedCount;
    const totalCaptured = syncResult.created;

    // 6. Broadcast changes
    if (totalCaptured > 0 || totalRelinked > 0) {
      dataEvents.emit();
    }

    return {
      scanned: scanResult.scanned,
      captured: totalCaptured,
      relinked: totalRelinked,
      unconfigured: backfillResult.unconfigured,
    };
  },
};
