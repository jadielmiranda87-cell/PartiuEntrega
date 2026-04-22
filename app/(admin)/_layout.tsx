import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

/** Rotas só para deep link / redirect; não aparecem na barra (ex.: `href: null` no Expo). */
const ADMIN_TAB_BAR_HIDDEN = new Set<string>(['sales-report']);

function AdminScrollTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const focusedRoute = state.routes[state.index];
  const focusedKey = focusedRoute?.key;

  return (
    <View
      style={[
        styles.tabBarWrap,
        {
          paddingBottom: insets.bottom + 8,
          borderTopColor: Colors.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.tabBarScrollContent}
      >
        {state.routes.map((route) => {
          if (ADMIN_TAB_BAR_HIDDEN.has(route.name)) return null;

          const { options } = descriptors[route.key];
          const isFocused = route.key === focusedKey;
          const active = options.tabBarActiveTintColor ?? Colors.primary;
          const inactive = options.tabBarInactiveTintColor ?? Colors.textMuted;
          const color = isFocused ? active : inactive;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              onPress={onPress}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color,
                size: 22,
              }) ?? (
                <MaterialIcons name="circle" size={22} color={color} />
              )}
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AdminLayout() {
  return (
    <Tabs
      tabBar={(props) => <AdminScrollTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="event-available" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="motoboys"
        options={{
          title: 'Motoboys',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="two-wheeler" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="businesses"
        options={{
          title: 'Comércios',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="store" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Entregas',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="local-shipping" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Vendas',
          tabBarLabel: 'Vendas',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="payments" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales-report"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: 'Config',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabBarScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 6,
    minHeight: 52,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    minWidth: 68,
  },
  tabItemPressed: { opacity: 0.75 },
  tabLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 80,
    textAlign: 'center',
  },
});
