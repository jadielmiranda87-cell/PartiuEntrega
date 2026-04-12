import { Stack } from 'expo-router';
import { APP_DISPLAY_NAME } from '@/constants/branding';
import { Colors } from '@/constants/theme';

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: APP_DISPLAY_NAME, headerLargeTitle: false }} />
      <Stack.Screen name="store/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ title: 'Carrinho' }} />
      <Stack.Screen name="checkout" options={{ title: 'Finalizar pedido' }} />
      <Stack.Screen name="order-payment" options={{ title: 'Pagamento' }} />
      <Stack.Screen name="saved-cards" options={{ title: 'Cartões salvos' }} />
      <Stack.Screen name="orders" options={{ title: 'Meus pedidos' }} />
      <Stack.Screen name="profile" options={{ title: 'Conta' }} />
    </Stack>
  );
}
