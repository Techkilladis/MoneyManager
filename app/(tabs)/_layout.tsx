import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadow, space } from '@/design/tokens';
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
    const color = focused ? colors.brand : colors.textTertiary;

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
        <Icon name={meta.icon} size={22} color={color} strokeWidth={focused ? 2.3 : 1.9} />
        <Text variant="caption" color={color} style={[styles.tabLabel, focused && styles.tabLabelActive]}>
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
          accessibilityLabel="Add expense"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }], backgroundColor: colors.brandPressed }]}
        >
          <Icon name="plus" size={26} color={colors.textOnBrand} strokeWidth={2.6} />
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
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadow.brand,
  },
}));
