import { EventEmitter } from 'expo-modules-core';

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

export interface MoneyManagerNotificationDetectionModule {
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

  // Development only - simulate notification for testing
  simulateUpiNotification(notification: NormalizedNotification): Promise<ParsedUpiTransaction | null>;
}

// ============================================
// Module Instance
// ============================================

declare const MoneyManagerNotificationDetectionModule: MoneyManagerNotificationDetectionModule;

export default MoneyManagerNotificationDetectionModule;