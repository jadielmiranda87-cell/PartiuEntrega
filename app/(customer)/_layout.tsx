import { Stack } from 'expo-router';
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
      <Stack.Screen name="index" options={{ title: 'FastFood', headerLargeTitle: false }} />
      <Stack.Screen name="store/[id]" options={{ title: 'Cardápio' }} />
      <Stack.Screen name="cart" options={{ title: 'Carrinho' }} />
      <Stack.Screen name="checkout" options={{ title: 'Finalizar pedido' }} />
      <Stack.Screen name="order-payment" options={{ title: 'Pagamento' }} />
      <Stack.Screen name="saved-cards" options={{ title: 'Cartões salvos' }} />
      <Stack.Screen name="orders" options={{ title: 'Meus pedidos' }} />
      <Stack.Screen name="profile" options={{ title: 'Conta' }} />
    </Stack>
  );
}
