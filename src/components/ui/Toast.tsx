// Lightweight toast for confirmations ("Payment saved"), optionally with one
// action ("Undo"). One at a time; a new toast replaces the current one.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadow, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type ToastTone = 'success' | 'info' | 'error';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const toneIcon: Record<ToastTone, IconName> = {
  success: 'check',
  info: 'info',
  error: 'alert',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const idRef = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'success', action?: ToastAction) => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, tone, action });
  }, []);

  useEffect(() => {
    if (!toast) return;
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 200 }),
      // Leave time to reach an action like Undo.
      Animated.delay(toast.action ? 4500 : 2200),
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    const id = toast.id;
    animation.start(({ finished }) => {
      if (finished) setToast((current) => (current?.id === id ? null : current));
    });
    return () => animation.stop();
  }, [toast, progress]);

  const api = useMemo(() => ({ show }), [show]);
  const toneColor = toast
    ? { success: colors.positive, info: colors.brand, error: colors.negative }[toast.tone]
    : colors.brand;

  const runAction = () => {
    const action = toast?.action;
    setToast(null);
    action?.onPress();
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.host, { top: insets.top + space.xs }]}>
          <Animated.View
            pointerEvents={toast.action ? 'auto' : 'none'}
            accessibilityLiveRegion="polite"
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
            <View style={[styles.badge, { backgroundColor: toneColor }]}>
              <Icon name={toneIcon[toast.tone]} size={14} color={colors.textOnBrand} strokeWidth={3} />
            </View>
            <Text variant="labelStrong" color={colors.textOnInk} style={{ flexShrink: 1 }}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={runAction}
                hitSlop={10}
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
              >
                <Text variant="labelStrong" color={scheme === 'dark' ? colors.brandPressed : '#7EDDBB'}>
                  {toast.action.label}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const useStyles = makeStyles((colors, scheme) => ({
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
    maxWidth: 440,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.lg,
    borderRadius: radius.pill,
    // An ink pill: dark on paper, light on the dark theme.
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
  action: {
    marginLeft: space.xs,
    paddingLeft: space.sm,
    borderLeftWidth: 1,
    borderLeftColor: scheme === 'dark' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
  },
}));
