import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getCustomerDeliveries } from '@/services/deliveryService';
import type { Delivery } from '@/types';
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

export default function CustomerOrdersScreen() {
  const { userId } = useAppAuth();
  const [list, setList] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await getCustomerDeliveries(userId);
    setList(data);
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Spacing.md }]}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24, gap: Spacing.sm }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS_LABEL[item.status] ?? { label: item.status, color: Colors.textMuted };
          const bizName = (item as any).businesses?.name ?? 'Restaurante';
          const pay = item.payment_status as string | undefined;
          const payPending =
            pay === 'awaiting_payment' || pay === 'processing' || pay === 'failed';
          const onPress = () => {
            if (payPending) {
              router.push(`/(customer)/order-payment?id=${item.id}`);
            } else {
              router.push(`/delivery/${item.id}`);
            }
          };
          return (
            <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
              <View style={styles.cardHeader}>
                <Text style={styles.bizName} numberOfLines={1}>{bizName}</Text>
                <View style={[styles.badge, { backgroundColor: st.color + '22' }]}>
                  <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              {payPending ? (
                <View style={styles.payRow}>
                  <MaterialIcons
                    name="payment"
                    size={16}
                    color={pay === 'failed' ? Colors.error : Colors.warning}
                  />
                  <Text style={[styles.payHint, pay === 'failed' && { color: Colors.error }]}>
                    {pay === 'failed'
                      ? 'Pagamento não concluído — toque para tentar de novo'
                      : 'Pagamento pendente — toque para pagar'}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.price}>{formatCurrency(item.price)}</Text>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  bizName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  payHint: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.warning },
  price: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: Spacing.sm },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md },
});
