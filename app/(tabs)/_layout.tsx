import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0071e3',
        tabBarInactiveTintColor: 'rgba(0, 0, 0, 0.48)',
        tabBarStyle: {
          height: 49 + (insets.bottom || 0),
          paddingBottom: insets.bottom || 0,
          backgroundColor: '#f5f5f7',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(0, 0, 0, 0.08)',
          ...(Platform.OS === 'ios' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
          } : {
            elevation: 8,
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '400',
          fontFamily: 'system-ui',
          letterSpacing: -0.2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
              <HomeIcon focused={focused} color={color} size={size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
              <TransactionsIcon focused={focused} color={color} size={size} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
              <SettingsIcon focused={focused} color={color} size={size} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

// Simple icon components using React Native primitives
function HomeIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.6;
  return (
    <View
      style={{
        width: iconSize,
        height: iconSize,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: iconSize * 0.7,
          height: iconSize * 0.7,
          borderWidth: focused ? 2.5 : 2,
          borderColor: color,
          borderRadius: 4,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

function TransactionsIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.6;
  return (
    <View
      style={{
        width: iconSize,
        height: iconSize,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: iconSize * 0.75,
          height: iconSize * 0.55,
          borderWidth: focused ? 2.5 : 2,
          borderColor: color,
          borderRadius: 2,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: iconSize * 0.1,
            right: iconSize * 0.1,
            top: iconSize * 0.15,
            height: 1,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: iconSize * 0.1,
            right: iconSize * 0.1,
            top: iconSize * 0.3,
            height: 1,
            backgroundColor: color,
            opacity: 0.6,
          }}
        />
      </View>
    </View>
  );
}

function SettingsIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.6;
  return (
    <View
      style={{
        width: iconSize,
        height: iconSize,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: iconSize * 0.7,
          height: iconSize * 0.7,
          borderWidth: focused ? 2.5 : 2,
          borderColor: color,
          borderRadius: iconSize * 0.35,
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: iconSize * 0.2,
            height: iconSize * 0.2,
            borderRadius: iconSize * 0.1,
            backgroundColor: color,
            top: iconSize * 0.08,
            left: iconSize * 0.25,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 1.5,
            height: iconSize * 0.25,
            backgroundColor: color,
            top: iconSize * 0.1,
            right: iconSize * 0.12,
          }}
        />
      </View>
    </View>
  );
}