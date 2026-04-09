import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import { useRides } from '@/contexts/RidesContext';

export default function MotoboyLayout() {
  const insets = useSafeAreaInsets();
  const { newRidesCount, isSoundPlaying, stopAlertSound } = useRides();

  return (
    <View style={styles.root}>
      {isSoundPlaying ? (
        <TouchableOpacity
          onPress={() => stopAlertSound()}
          style={[styles.soundBanner, { paddingTop: Math.max(insets.top, Spacing.sm) }]}
          activeOpacity={0.85}
        >
          <MaterialIcons name="volume-up" size={22} color={Colors.warning} />
          <Text style={styles.soundBannerText}>Alerta tocando — toque para silenciar</Text>
          <MaterialIcons name="volume-off" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
        },
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Corridas',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="motorcycle" size={size} color={color} />,
          tabBarBadge: newRidesCount > 0 ? newRidesCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.primary,
            color: '#fff',
            fontSize: 11,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="my-rides"
        options={{
          title: 'Minhas Corridas',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="local-shipping" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Ganhos',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="account-balance-wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  soundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.warning + '22',
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '44',
  },
  soundBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
});
