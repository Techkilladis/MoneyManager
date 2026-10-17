/** Thin wrapper so haptics never throw (unsupported devices, web). */
import * as Haptics from 'expo-haptics';

const ignore = () => undefined;

export const haptic = {
  /** Picking a chip, tile or tab. */
  select: () => void Haptics.selectionAsync().catch(ignore),
  /** A light physical tap, e.g. a stepper. */
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore),
  /** Saved, confirmed, unlocked. */
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore),
  /** Deleted or something worth noticing. */
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore),
};
