// ============================================
// Types
// ============================================

export interface PendingUpiEvent {
  id: string;
  amountPaise: number;
  merchant: string;
  sourceApp: string;
  transactionTimestamp: number;
  transactionReference?: string;
  parserName: string;
  parserVersion?: string;
  confidence: number;
  notificationId: string;
  status: 'PENDING' | 'CONSUMED' | 'DISMISSED' | 'FAILED';
  createdAt: number;
  dedupeKey: string;
  direction?: 'DEBIT' | 'CREDIT';
}

export type TransactionStatus = 'PENDING' | 'CONSUMED' | 'DISMISSED' | 'FAILED';

export interface SmsScanResult {
  scanned: number;
  captured: number;
}

// ============================================
// Module Interface
// ============================================

export interface MoneyManagerNotificationDetectionModuleType {
  initialize(): Promise<{ success: boolean }>;

  // SMS access (READ_SMS + RECEIVE_SMS; the runtime prompt is requested from JS)
  isSmsAccessEnabled(): Promise<{ enabled: boolean }>;
  scanSmsInbox(firstScanDays: number): Promise<SmsScanResult>;

  // Pending Events
  getPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  getAllPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  getPendingUpiEvent(id: string): Promise<{ event: PendingUpiEvent | null }>;
  consumePendingUpiEvent(id: string): Promise<void>;
  dismissPendingUpiEvent(id: string): Promise<void>;

  // Developer/Diagnostic
  getParsingStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    byParser: Record<string, number>;
    byStatus: Record<string, number>;
  }>;
  simulateSms(
    sender: string,
    body: string
  ): Promise<{ amountPaise: number; merchant: string | null; transactionReference: string | null; direction: 'DEBIT' | 'CREDIT' } | null>;

  getCaptureHealth(): Promise<Record<string, unknown>>;
  openAppDetailsSettings(): Promise<void>;
  openPopupSettings(): Promise<void>;
  openAutostartSettings(): Promise<void>;
  requestBatteryUnrestricted(): Promise<void>;
  openBackgroundPopupSettings(): Promise<void>;

  // Home-screen widget
  updateWidget(data: { today: string; month: string; dayKey: string; monthKey: string }): Promise<void>;
}

// ============================================
// Module Instance
// ============================================

declare const MoneyManagerNotificationDetectionModule: MoneyManagerNotificationDetectionModuleType;

export default MoneyManagerNotificationDetectionModule;