import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { AuthProvider } from '@/contexts/AuthContext';
import { RidesProvider } from '@/contexts/RidesContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <RidesProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register-business" />
            <Stack.Screen name="register-motoboy" />
            <Stack.Screen name="payment" />
            <Stack.Screen name="pending-approval" />
            <Stack.Screen name="renew-subscription" />
            <Stack.Screen name="(business)" />
            <Stack.Screen name="(motoboy)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="ride/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="delivery/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
          </Stack>
          </RidesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
