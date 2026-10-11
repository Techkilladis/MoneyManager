import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '@/design/tokens';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          height: 56 + (insets.bottom || 0),
          paddingBottom: insets.bottom || 0,
          paddingHorizontal: spacing[4],
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.dividerLight,
          ...(Platform.OS === 'ios' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.04,
            shadowRadius: 12,
          } : {
            elevation: 4,
          }),
        },
        tabBarLabelStyle: {
          fontSize: typography.size.caption2,
          fontWeight: typography.weight.medium,
          fontFamily: typography.fontFamily.primary,
          letterSpacing: typography.letterSpacing.caption,
          marginTop: spacing[1],
        },
        tabBarItemStyle: {
          paddingVertical: spacing[2],
          paddingHorizontal: spacing[1],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
              <HomeIcon focused={focused} color={focused ? colors.accent : colors.textTertiary} size={size * 0.55} />
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
              <TransactionsIcon focused={focused} color={focused ? colors.accent : colors.textTertiary} size={size * 0.55} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
              <AnalyticsIcon focused={focused} color={focused ? colors.accent : colors.textTertiary} size={size * 0.55} />
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
              <SettingsIcon focused={focused} color={focused ? colors.accent : colors.textTertiary} size={size * 0.55} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

// Apple/Linear inspired icon components
function HomeIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.7;
  const strokeWidth = focused ? 2.5 : 1.5;
  
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
          height: iconSize * 0.75,
          borderWidth: strokeWidth,
          borderColor: color,
          borderRadius: radius.small,
          transform: [{ rotate: '45deg' }],
        }}
      />
      {focused && (
        <View
          style={{
            position: 'absolute',
            bottom: iconSize * 0.05,
            left: '50%',
            marginLeft: -2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

function TransactionsIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.7;
  const strokeWidth = focused ? 2.5 : 1.5;
  
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
          width: iconSize * 0.8,
          height: iconSize * 0.55,
          borderWidth: strokeWidth,
          borderColor: color,
          borderRadius: radius.micro,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: iconSize * 0.1,
            right: iconSize * 0.1,
            top: iconSize * 0.18,
            height: 1.5,
            backgroundColor: color,
            opacity: focused ? 1 : 0.5,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: iconSize * 0.1,
            right: iconSize * 0.1,
            top: iconSize * 0.38,
            height: 1.5,
            backgroundColor: color,
            opacity: focused ? 1 : 0.4,
          }}
        />
        {focused && (
          <View
            style={{
              position: 'absolute',
              left: iconSize * 0.1,
              right: iconSize * 0.1,
              top: iconSize * 0.58,
              height: 1.5,
              backgroundColor: color,
              opacity: 0.3,
            }}
          />
        )}
      </View>
    </View>
  );
}

function SettingsIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.7;
  const strokeWidth = focused ? 2.5 : 1.5;
  
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
          height: iconSize * 0.75,
          borderWidth: strokeWidth,
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
            left: iconSize * 0.275,
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
            opacity: focused ? 1 : 0.6,
          }}
        />
        {focused && (
          <View
            style={{
              position: 'absolute',
              width: iconSize * 0.15,
              height: iconSize * 0.15,
              borderRadius: iconSize * 0.075,
              borderWidth: 1.5,
              borderColor: color,
              bottom: iconSize * 0.08,
              right: iconSize * 0.08,
            }}
          />
        )}
      </View>
    </View>
  );
}

function AnalyticsIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
  const iconSize = size * 0.7;
  const strokeWidth = focused ? 2.5 : 1.5;
  
  return (
    <View
      style={{
        width: iconSize,
        height: iconSize,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Bar chart icon */}
      <View
        style={{
          width: iconSize * 0.8,
          height: iconSize * 0.65,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: iconSize * 0.05,
        }}
      >
        <View
          style={{
            width: iconSize * 0.18,
            height: iconSize * 0.25,
            borderRadius: radius.micro,
            backgroundColor: color,
            opacity: focused ? 1 : 0.7,
          }}
        />
        <View
          style={{
            width: iconSize * 0.18,
            height: iconSize * 0.45,
            borderRadius: radius.micro,
            backgroundColor: color,
            opacity: focused ? 1 : 0.7,
          }}
        />
        <View
          style={{
            width: iconSize * 0.18,
            height: iconSize * 0.35,
            borderRadius: radius.micro,
            backgroundColor: color,
            opacity: focused ? 1 : 0.7,
          }}
        />
        <View
          style={{
            width: iconSize * 0.18,
            height: iconSize * 0.55,
            borderRadius: radius.micro,
            backgroundColor: color,
            opacity: focused ? 1 : 0.5,
          }}
        />
      </View>
      {focused && (
        <View
          style={{
            position: 'absolute',
            bottom: iconSize * 0.05,
            left: '50%',
            marginLeft: -2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}