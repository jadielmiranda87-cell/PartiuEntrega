import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { RidesProvider } from '@/contexts/RidesContext';
import { requestAllRuntimePermissions } from '@/services/permissionsService';

import { storageKey } from '@/constants/branding';
import { Colors } from '@/constants/theme';

const PERMISSIONS_ASKED_KEY = storageKey('runtimePermissionsAsked');

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors.background).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const asked = await AsyncStorage.getItem(PERMISSIONS_ASKED_KEY);
        if (asked === 'true') return;
        await requestAllRuntimePermissions();
        await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
      } catch {
        // Ignora erros
      }
    })();
  }, []);

  return (
    <AlertProvider>
      <StatusBar style="dark" />
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
          <RidesProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register-business" />
            <Stack.Screen name="register-motoboy" />
            <Stack.Screen name="register-customer" />
            <Stack.Screen name="payment" />
            <Stack.Screen name="pending-approval" />
            <Stack.Screen name="renew-subscription" />
            <Stack.Screen name="(business)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(motoboy)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="ride/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="delivery/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="order-payment" options={{ headerShown: false }} />
          </Stack>
          </RidesProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
