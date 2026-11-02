import { PermissionsAndroid, Platform } from 'react-native';
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

export interface ParsedSms {
  amountPaise: number;
  merchant?: string | null;
  transactionReference?: string | null;
  direction: 'DEBIT' | 'CREDIT';
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
  /** READ_SMS + RECEIVE_SMS are both granted. */
  accessEnabled: boolean;
  lastUpiMessageAt: number | null;
  lastCaptureAt: number | null;
  manufacturer: string;
  sdkInt: number;
  widgetCount: number;
  /** "Display over other apps" is allowed, so a new payment opens the review screen by itself. */
  popupEnabled?: boolean;
  /** A heads-up notification is posted for each new payment. */
  notificationsEnabled?: boolean;
  /** Last time the live SMS receiver ran (any SMS). */
  lastReceiverAt?: number | null;
  /** Last time an inbox scan found a payment the live receiver never saw. */
  lastMissedAt?: number | null;
  /** Left out of battery optimisation. */
  batteryUnrestricted?: boolean;
  /** The phone has an OEM Autostart switch (Xiaomi, Oppo, Vivo, Huawei...). */
  hasAutostartSetting?: boolean;
  isXiaomi?: boolean;
  /** Xiaomi "Display pop-up windows while running in the background"; null when unreadable. */
  backgroundPopupAllowed?: boolean | null;
}

export interface SmsScanResult {
  scanned: number;
  captured: number;
}

export interface WidgetSnapshot {
  today: string;
  month: string;
  dayKey: string;
  monthKey: string;
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
  isSmsAccessEnabled(): Promise<{ enabled: boolean }>;
  scanSmsInbox(firstScanDays: number): Promise<SmsScanResult>;
  getPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  getAllPendingUpiEvents(): Promise<{ events: PendingUpiEvent[] }>;
  getPendingUpiEvent(id: string): Promise<{ event: PendingUpiEvent | null }>;
  consumePendingUpiEvent(id: string): Promise<void>;
  dismissPendingUpiEvent(id: string): Promise<void>;
  getParsingStats(): Promise<ParsingStats>;
  simulateSms(sender: string, body: string): Promise<ParsedSms | null>;
  getCaptureHealth(): Promise<CaptureHealth>;
  openAppDetailsSettings(): Promise<void>;
  openPopupSettings(): Promise<void>;
  openAutostartSettings(): Promise<void>;
  requestBatteryUnrestricted(): Promise<void>;
  openBackgroundPopupSettings(): Promise<void>;
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

  async isSmsAccessEnabled(): Promise<boolean> {
    if (!this.nativeModule) return false;
    try {
      const result = await this.nativeModule.isSmsAccessEnabled();
      return result.enabled;
    } catch (error) {
      console.error('NotificationDetectionService: Failed to check SMS access', error);
      return false;
    }
  }

  /** Shows the system SMS permission prompt. Resolves true when both permissions are granted. */
  async requestSmsAccess(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);
      return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
    } catch (error) {
      console.error('NotificationDetectionService: SMS permission request failed', error);
      return false;
    }
  }

  /**
   * Reads recent bank SMS and stores any UPI payments found as pending events.
   * The first scan looks back `firstScanDays`; later scans continue from the last one.
   */
  async scanSmsInbox(firstScanDays = 7): Promise<SmsScanResult> {
    if (!this.nativeModule) return { scanned: 0, captured: 0 };
    try {
      return await this.nativeModule.scanSmsInbox(firstScanDays);
    } catch (error) {
      console.error('NotificationDetectionService: SMS scan failed', error);
      return { scanned: 0, captured: 0 };
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

  /** One native event by id, whatever its status; null when unknown. */
  async getPendingUpiEvent(id: string): Promise<PendingUpiEvent | null> {
    if (!this.nativeModule?.getPendingUpiEvent) return null;
    try {
      const result = await this.nativeModule.getPendingUpiEvent(id);
      return result.event;
    } catch (error) {
      console.error('NotificationDetectionService: Failed to get event', error);
      return null;
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

  /** SMS permission and last-capture state, used to show whether auto-capture is working. */
  async getCaptureHealth(): Promise<CaptureHealth | null> {
    if (!this.nativeModule?.getCaptureHealth) return null;
    try {
      return await this.nativeModule.getCaptureHealth();
    } catch (error) {
      console.warn('NotificationDetectionService: Failed to read capture health', error);
      return null;
    }
  }

  async openAppDetailsSettings(): Promise<void> {
    await this.nativeModule?.openAppDetailsSettings?.().catch(() => undefined);
  }

  /** System screen for "Display over other apps". */
  async openPopupSettings(): Promise<void> {
    await this.nativeModule?.openPopupSettings?.().catch(() => undefined);
  }

  /** OEM Autostart list, so a bank SMS can wake the app after it is swiped away. */
  async openAutostartSettings(): Promise<void> {
    await this.nativeModule?.openAutostartSettings?.().catch(() => undefined);
  }

  /** System prompt to stop battery optimisation for the app. */
  async requestBatteryUnrestricted(): Promise<void> {
    await this.nativeModule?.requestBatteryUnrestricted?.().catch(() => undefined);
  }

  /** Xiaomi "Other permissions" page (background pop-ups). */
  async openBackgroundPopupSettings(): Promise<void> {
    await this.nativeModule?.openBackgroundPopupSettings?.().catch(() => undefined);
  }

  async updateWidget(data: WidgetSnapshot): Promise<void> {
    await this.nativeModule?.updateWidget?.(data).catch(() => undefined);
  }

  /** Parses a sample SMS without storing it. */
  async simulateSms(sender: string, body: string): Promise<ParsedSms | null> {
    if (!this.nativeModule) return null;
    try {
      return await this.nativeModule.simulateSms(sender, body);
    } catch (error) {
      console.error('NotificationDetectionService: Simulation failed', error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationDetectionService = new NotificationDetectionService();