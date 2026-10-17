// Lightweight toast for confirmations ("Payment saved"). One at a time;
// a new toast replaces the current one.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/design/tokens';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type ToastTone = 'success' | 'info' | 'error';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const toneStyle: Record<ToastTone, { icon: IconName; color: string }> = {
  success: { icon: 'check', color: colors.positive },
  info: { icon: 'info', color: colors.brand },
  error: { icon: 'alert', color: colors.negative },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const idRef = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 200 }),
      Animated.delay(2200),
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    const id = toast.id;
    animation.start(({ finished }) => {
      if (finished) setToast((current) => (current?.id === id ? null : current));
    });
    return () => animation.stop();
  }, [toast, progress]);

  const api = useMemo(() => ({ show }), [show]);
  const tone = toast ? toneStyle[toast.tone] : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && tone ? (
        <View pointerEvents="none" style={[styles.host, { top: insets.top + space.xs }]}>
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: progress,
                transform: [
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
              },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: tone.color }]}>
              <Icon name={tone.icon} size={14} color={colors.textOnBrand} strokeWidth={3} />
            </View>
            <Text variant="labelStrong" color={colors.textOnDark} style={{ flexShrink: 1 }}>
              {toast.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 420,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    ...shadow.raised,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
