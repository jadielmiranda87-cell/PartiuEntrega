import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { getDeliveryById } from '@/services/deliveryService';
import { subscribeDeliveryRealtime } from '@/services/deliveryRealtimeService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';

export default function TrackDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!id) return;

    // Carga inicial
    getDeliveryById(id).then(setDelivery).finally(() => setLoading(false));

    // Inscrição para atualizações em tempo real (motoboy_lat, motoboy_lng, status)
    const unsub = subscribeDeliveryRealtime(id, (updated) => {
      setDelivery((prev: any) => ({ ...prev, ...updated }));
    });

    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textSecondary }}>Conectando ao rastreio...</Text>
      </View>
    );
  }

  if (!delivery) return null;

  const motoboyPos = delivery.motoboy_lat ? { latitude: Number(delivery.motoboy_lat), longitude: Number(delivery.motoboy_lng) } : null;
  const storePos = delivery.businesses?.latitude ? { latitude: Number(delivery.businesses.latitude), longitude: Number(delivery.businesses.longitude) } : null;
  const customerPos = delivery.delivery_lat ? { latitude: Number(delivery.delivery_lat), longitude: Number(delivery.delivery_lng) } : null;

  // Define o ícone e texto baseado no status
  const isHeadingToStore = delivery.status === 'assigned';
  const isHeadingToCustomer = delivery.status === 'collected';

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: motoboyPos?.latitude || storePos?.latitude || -16.68,
          longitude: motoboyPos?.longitude || storePos?.longitude || -49.25,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {customerPos && (
          <Marker coordinate={customerPos} title="Sua Casa">
            <MaterialIcons name="home" size={32} color={Colors.info} />
          </Marker>
        )}

        {storePos && (
          <Marker coordinate={storePos} title="Restaurante">
            <MaterialIcons name="store" size={32} color={Colors.text} />
          </Marker>
        )}

        {motoboyPos && (
          <Marker coordinate={motoboyPos} title="Entregador" flat anchor={{ x: 0.5, y: 0.5 }}>
            <MaterialIcons name="two-wheeler" size={36} color={Colors.primary} />
          </Marker>
        )}
      </MapView>

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 16 }]} onPress={() => router.back()}>
        <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.statusRow}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>
            {isHeadingToStore ? 'Entregador indo para o restaurante' :
             isHeadingToCustomer ? 'Pedido coletado! Indo até você' : 'Acompanhando entrega'}
          </Text>
        </View>
        <Text style={styles.bizName}>{delivery.businesses?.name}</Text>
        <Text style={styles.orderId}>Pedido #{delivery.id.substring(0, 8)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,
  },
  bottomCard: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  statusText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  bizName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  orderId: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
});
