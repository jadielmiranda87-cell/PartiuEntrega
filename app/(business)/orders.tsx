import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getBusinessDeliveries } from '@/services/deliveryService';
import { subscribeBusinessDeliveries } from '@/services/deliveryRealtimeService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate } from '@/utils/links';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando', color: Colors.warning },
  assigned: { label: 'A caminho', color: Colors.info },
  collected: { label: 'Coletado', color: Colors.primary },
  delivered: { label: 'Entregue', color: Colors.success },
  cancelled: { label: 'Cancelado', color: Colors.error },
};

export default function BusinessOrdersScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { businessProfile, loading: authLoading } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadDeliveries = useCallback(async () => {
    if (!businessProfile) {
      setLoading(false);
      return;
    }
    const data = await getBusinessDeliveries(businessProfile.id);
    setDeliveries(data);
    setLoading(false);
    setRefreshing(false);
  }, [businessProfile]);

  const loadDeliveriesRef = useRef(loadDeliveries);
  useEffect(() => {
    loadDeliveriesRef.current = loadDeliveries;
  }, [loadDeliveries]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !businessProfile?.id) {
        return () => {};
      }

      loadDeliveries();
      const unsub = subscribeBusinessDeliveries(businessProfile.id, () => {
        loadDeliveriesRef.current();
      });

      return () => {
        unsub();
      };
    }, [authLoading, businessProfile?.id, loadDeliveries])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDeliveries();
  };

  if (authLoading || (loading && businessProfile !== null)) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="store" size={48} color={Colors.textMuted} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: FontSize.md }}>Comércio não encontrado</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={[styles.pageTitle, { paddingHorizontal: Spacing.md, paddingTop: Spacing.md }]}>Meus Pedidos</Text>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 16, gap: Spacing.sm, paddingTop: Spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
            <Text style={styles.emptySubText}>Crie uma nova entrega na aba "Nova Entrega"</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS_LABEL[item.status] ?? { label: item.status, color: Colors.textMuted };
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/delivery/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{item.customer_name}</Text>
                <View style={[styles.badge, { backgroundColor: st.color + '22' }]}>
                  <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={styles.cardAddress}>{item.customer_address}, {item.customer_address_number} — {item.customer_neighborhood}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>
              {(item as any).motoboys?.name && (
                <View style={styles.motoboyRow}>
                  <MaterialIcons name="two-wheeler" size={14} color={Colors.textMuted} />
                  <Text style={styles.motoboyName}>{(item as any).motoboys.name}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  customerName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1 },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  cardAddress: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  motoboyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  motoboyName: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: 64, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
