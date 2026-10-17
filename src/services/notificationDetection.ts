import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// Import the native module. Expo modules (expo.modules.kotlin) are exposed
// through expo-modules-core, not through React Native's `NativeModules` object.
// `requireOptionalNativeModule` returns null when the module isn't available
// (e.g. on non-Android platforms), which this service handles gracefully.
const MoneyManagerNotificationDetection = requireOptionalNativeModule<NativeModuleInterface>('MoneyManagerNotificationDetection');

// Check if module is available
const isModuleAvailable = !!MoneyManagerNotificationDetection;

// ============================================
// Type Definitions
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
  /** DEBIT = money out (expense), CREDIT = money in (income). */
  direction?: 'DEBIT' | 'CREDIT';
}

export interface CaptureHealth {
  accessEnabled: boolean;
  listenerConnected: boolean;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  lastUpiNotificationAt: number | null;
  lastCaptureAt: number | null;
  ignoringBatteryOptimizations: boolean;
  manufacturer: string;
  sdkInt: number;
  widgetCount: number;
}

export interface WidgetSnapshot {
  today: string;
  month: string;
  dayKey: string;
  monthKey: string;
}

export interface NotificationAccessStatus {
  enabled: boolean;
}

export interface ParsingStats {
  total: number;
  bySource: Record<string, number>;
  byParser: Record<string, number>;
  byStatus: Record<string, number>;
}

// ============================================
// Native Module Interface
// ============================================

interface NativeModuleInterface {
  initialize(): Promise<{ success: boolean }>;
  isNotificationAccessEnabled(): Promise<NotificationAccessStatus>;
  openNotificationAccessSettings(): Promise<void>;
  getPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  getAllPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  consumePendingUpiEvent(id: string): Promise<void>;
  dismissPendingUpiEvent(id: string): Promise<void>;
  getParsingStats(): Promise<ParsingStats>;
  simulateUpiNotification(notification: NormalizedNotification): Promise<ParsedUpiTransaction | null>;
  getCaptureHealth(): Promise<CaptureHealth>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  openAppDetailsSettings(): Promise<void>;
  requestListenerRebind(): Promise<boolean>;
  updateWidget(data: WidgetSnapshot): Promise<void>;
}

// ============================================
// Service Class
// ============================================

class NotificationDetectionService {
  private nativeModule: NativeModuleInterface | null = null;
  private initialized = false;

  constructor() {
    if (Platform.OS === 'android' && isModuleAvailable) {
      this.nativeModule = MoneyManagerNotificationDetection as NativeModuleInterface;
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.nativeModule) {
      console.warn('NotificationDetectionService: Native module not available');
      return false;
    }

    if (this.initialized) {
      return true;
    }

    try {
      const result = await this.nativeModule.initialize();
      this.initialized = result.success;
      return this.initialized;
    } catch (error) {
      console.error('NotificationDetectionService: Initialization failed', error);
      return false;
    }
  }

  async isNotificationAccessEnabled(): Promise<boolean> {
    if (!this.nativeModule) return false;
    try {
      const result = await this.nativeModule.isNotificationAccessEnabled();
      return result.enabled;
    } catch (error) {
      console.error('NotificationDetectionService: Failed to check access', error);
      return false;
    }
  }

  async openNotificationAccessSettings(): Promise<void> {
    if (!this.nativeModule) return;
    try {
      await this.nativeModule.openNotificationAccessSettings();
    } catch (error) {
      console.error('NotificationDetectionService: Failed to open settings', error);
    }
  }

  async getPendingUpiEvents(): Promise<PendingUpiEvent[]> {
    if (!this.nativeModule) return [];
    try {
      const result = await this.nativeModule.getPendingUpiEvents();
      return result.events;
    } catch (error) {
      console.error('NotificationDetectionService: Failed to get pending events', error);
      return [];
    }
  }

  async getAllPendingUpiEvents(): Promise<PendingUpiEvent[]> {
    if (!this.nativeModule) return [];
    try {
      const result = await this.nativeModule.getAllPendingUpiEvents();
      return result.events;
    } catch (error) {
      console.error('NotificationDetectionService: Failed to get all events', error);
      return [];
    }
  }

  async consumePendingUpiEvent(id: string): Promise<void> {
    if (!this.nativeModule) return;
    try {
      await this.nativeModule.consumePendingUpiEvent(id);
    } catch (error) {
      console.error('NotificationDetectionService: Failed to consume event', error);
    }
  }

  async dismissPendingUpiEvent(id: string): Promise<void> {
    if (!this.nativeModule) return;
    try {
      await this.nativeModule.dismissPendingUpiEvent(id);
    } catch (error) {
      console.error('NotificationDetectionService: Failed to dismiss event', error);
    }
  }

  async getParsingStats(): Promise<ParsingStats> {
    if (!this.nativeModule) {
      return { total: 0, bySource: {}, byParser: {}, byStatus: {} };
    }
    try {
      return await this.nativeModule.getParsingStats();
    } catch (error) {
      console.error('NotificationDetectionService: Failed to get stats', error);
      return { total: 0, bySource: {}, byParser: {}, byStatus: {} };
    }
  }

  isAvailable(): boolean {
    return this.nativeModule !== null;
  }

  /** Listener/battery state used to warn when auto-capture has silently stopped. */
  async getCaptureHealth(): Promise<CaptureHealth | null> {
    if (!this.nativeModule?.getCaptureHealth) return null;
    try {
      return await this.nativeModule.getCaptureHealth();
    } catch (error) {
      console.warn('NotificationDetectionService: Failed to read capture health', error);
      return null;
    }
  }

  async requestIgnoreBatteryOptimizations(): Promise<void> {
    await this.nativeModule?.requestIgnoreBatteryOptimizations?.().catch(() => undefined);
  }

  async openAppDetailsSettings(): Promise<void> {
    await this.nativeModule?.openAppDetailsSettings?.().catch(() => undefined);
  }

  async requestListenerRebind(): Promise<boolean> {
    if (!this.nativeModule?.requestListenerRebind) return false;
    return this.nativeModule.requestListenerRebind().catch(() => false);
  }

  async updateWidget(data: WidgetSnapshot): Promise<void> {
    await this.nativeModule?.updateWidget?.(data).catch(() => undefined);
  }

  async simulateUpiNotification(notification: NormalizedNotification): Promise<ParsedUpiTransaction | null> {
    if (!this.nativeModule) return null;
    try {
      return await this.nativeModule.simulateUpiNotification(notification);
    } catch (error) {
      console.error('NotificationDetectionService: Simulation failed', error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationDetectionService = new NotificationDetectionService();