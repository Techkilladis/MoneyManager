// Bottom sheet built on React Native's Modal: scrim fades, panel springs up.
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { IconButton } from './Button';
import { Text } from './Text';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function Sheet({ visible, onClose, title, subtitle, children, footer, scroll = true }: SheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));

  // Keep the Modal mounted while the close animation runs.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT * 0.6, 0] });

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.md), transform: [{ translateY }] }]}
        >
          <View style={styles.grabber} />
          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text variant="title">{title}</Text>
                {subtitle ? (
                  <Text variant="label" style={{ marginTop: 2 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="x" size={36} background={colors.surfaceMuted} onPress={onClose} accessibilityLabel="Close" />
            </View>
          ) : null}
          {body}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: colors.scrim,
  },
  panel: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginTop: space.xs,
    marginBottom: space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
}));
