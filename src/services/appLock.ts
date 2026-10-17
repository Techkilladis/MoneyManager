/**
 * App lock with the phone's own fingerprint, face or screen lock
 * (expo-local-authentication). The app never sees or stores a PIN.
 */
import * as LocalAuthentication from 'expo-local-authentication';

export interface LockSupport {
  /** True when the phone has any secure lock (biometric or PIN/pattern). */
  available: boolean;
  label: string;
}

export async function getLockSupport(): Promise<LockSupport> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) {
      return { available: false, label: 'Screen lock' };
    }
    if (level === LocalAuthentication.SecurityLevel.SECRET) {
      return { available: true, label: 'Screen lock' };
    }
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const label = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'Fingerprint'
      : types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? 'Face unlock'
        : 'Biometrics';
    return { available: true, label };
  } catch {
    return { available: false, label: 'Screen lock' };
  }
}

let suppressUntil = 0;

/**
 * Call before opening something outside the app that we return from (share
 * sheet, file picker, system settings) so coming back doesn't lock.
 */
export function suppressLock(ms = 120_000): void {
  suppressUntil = Date.now() + ms;
}

export function isLockSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

export function clearLockSuppression(): void {
  suppressUntil = 0;
}

export async function authenticate(reason = 'Unlock Money Manager'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      requireConfirmation: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
