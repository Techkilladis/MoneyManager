import React from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Icon, IconName, Text } from '@/components/ui';
import { session } from '@/services/session';
import { haptic } from '@/utils/haptics';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  transactions: { label: 'History', icon: 'receipt' },
  analytics: { label: 'Insights', icon: 'pie' },
  settings: { label: 'Settings', icon: 'settings' },
};

export default function TabLayout() {
  if (session.needsOnboarding) return <Redirect href="/onboarding" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

/** Four tabs with a raised "add expense" button in the centre (thumb zone). */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const renderTab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const meta = TAB_META[route.name] ?? { label: route.name, icon: 'home' as IconName };
    const focused = state.index === index;
    const color = focused ? colors.text : colors.textTertiary;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        haptic.select();
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        style={styles.tab}
      >
        <Icon name={meta.icon} size={22} color={color} strokeWidth={focused ? 2.2 : 1.9} />
        <Text variant="caption" color={color} style={[focused && styles.tabLabelActive]}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.xs) }]}>
      {renderTab(0)}
      {renderTab(1)}
      <View style={styles.fabSlot}>
        <Pressable
          onPress={() => {
            haptic.tap();
            router.push('/transactions/new');
          }}
          accessibilityRole="button"
          accessibilityLabel="Add expense — plus icon in the centre of the tab bar"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 }]}
        >
          <Icon name="plus" size={24} color={colors.textOnInk} strokeWidth={2.4} />
        </Pressable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.xs,
    paddingHorizontal: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 4,
  },
  tabLabelActive: {
    // caption variant already sets fontSize: 13, lineHeight: 18;
    // tighten slightly for the tab bar context.
    lineHeight: 16,
  },
  fabSlot: {
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  // The add button: an ink tile in the middle of the bar (thumb zone).
  fab: {
    width: 56,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
