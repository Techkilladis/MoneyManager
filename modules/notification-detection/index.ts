// ============================================
// Types
// ============================================

export interface NormalizedNotification {
  notificationId: string;
  packageName: string;
  title?: string;
  text?: string;
  bigText?: string;
  subText?: string;
  postTime: number;
  when?: number;
}

export interface ParsedUpiTransaction {
  amountPaise: number;
  merchant?: string;
  sourceApp: string;
  transactionTimestamp: number;
  transactionReference?: string;
  parserName: string;
  parserVersion?: string;
  confidence: number;
  direction?: 'DEBIT' | 'CREDIT';
}

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

export interface NotificationAccessStatus {
  enabled: boolean;
}

// ============================================
// Event Types
// ============================================

export interface PendingUpiEventEvent {
  event: PendingUpiEvent;
}

export interface NotificationAccessChangedEvent {
  enabled: boolean;
}

// ============================================
// Module Interface
// ============================================

export interface MoneyManagerNotificationDetectionModuleType {
  // Initialization
  initialize(): Promise<{ success: boolean }>;

  // Notification Access
  isNotificationAccessEnabled(): Promise<NotificationAccessStatus>;
  openNotificationAccessSettings(): Promise<void>;

  // Pending Events
  getPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  getAllPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  consumePendingUpiEvent(id: string): Promise<void>;
  dismissPendingUpiEvent(id: string): Promise<void>;

  // Developer/Diagnostic
  getParsingStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    byParser: Record<string, number>;
    byStatus: Record<string, number>;
  }>;

  // Capture reliability
  getCaptureHealth(): Promise<Record<string, unknown>>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  openAppDetailsSettings(): Promise<void>;
  requestListenerRebind(): Promise<boolean>;

  // Home-screen widget
  updateWidget(data: { today: string; month: string; dayKey: string; monthKey: string }): Promise<void>;

  // Development only - simulate notification for testing
  simulateUpiNotification(notification: NormalizedNotification): Promise<ParsedUpiTransaction | null>;
}

// ============================================
// Module Instance
// ============================================

declare const MoneyManagerNotificationDetectionModule: MoneyManagerNotificationDetectionModuleType;

export default MoneyManagerNotificationDetectionModule;