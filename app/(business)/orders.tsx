import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { useRides } from '@/contexts/RidesContext';
import {
  getBusinessDeliveries,
  businessAcceptAppOrder,
  businessRejectAppOrder,
} from '@/services/deliveryService';
import { subscribeBusinessDeliveries } from '@/services/deliveryRealtimeService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate } from '@/utils/links';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando entregador', color: Colors.warning },
  assigned: { label: 'A caminho', color: Colors.info },
  collected: { label: 'Coletado', color: Colors.primary },
  delivered: { label: 'Entregue', color: Colors.success },
  cancelled: { label: 'Cancelado', color: Colors.error },
};

function needsMerchantAction(d: Delivery): boolean {
  return (
    d.order_source === 'app' &&
    d.payment_status === 'paid' &&
    d.merchant_acceptance === 'pending'
  );
}

function statusForCard(item: Delivery): { label: string; color: string } {
  if (needsMerchantAction(item)) {
    return { label: 'Confirmar pedido', color: Colors.secondary };
  }
  const st = STATUS_LABEL[item.status];
  return st ?? { label: item.status, color: Colors.textMuted };
}

export default function BusinessOrdersScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const { businessProfile, loading: authLoading } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { startAlertSound, stopAlertSound } = useRides();

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

  const pendingMerchantCount = useMemo(
    () => deliveries.filter(needsMerchantAction).length,
    [deliveries]
  );

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

  useFocusEffect(
    useCallback(() => {
      if (pendingMerchantCount > 0) {
        startAlertSound();
      } else {
        stopAlertSound();
      }
      return () => {
        stopAlertSound();
      };
    }, [pendingMerchantCount, startAlertSound, stopAlertSound])
  );

  const sortedDeliveries = useMemo(() => {
    const copy = [...deliveries];
    copy.sort((a, b) => {
      const na = needsMerchantAction(a) ? 0 : 1;
      const nb = needsMerchantAction(b) ? 0 : 1;
      if (na !== nb) return na - nb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return copy;
  }, [deliveries]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDeliveries();
  };

  const onAccept = async (id: string) => {
    if (!businessProfile) return;
    setActingId(id);
    const { error } = await businessAcceptAppOrder(id, businessProfile.id);
    setActingId(null);
    if (error) showAlert('Erro', error);
    else loadDeliveries();
  };

  const onReject = (id: string) => {
    showAlert(
      'Recusar pedido?',
      'O valor pago será estornado integralmente ao cliente no Mercado Pago.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar e estornar',
          style: 'destructive',
          onPress: async () => {
            setActingId(id);
            const { error } = await businessRejectAppOrder(id);
            setActingId(null);
            if (error) showAlert('Estorno', error);
            else loadDeliveries();
          },
        },
      ]
    );
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
      {pendingMerchantCount > 0 ? (
        <View style={styles.banner}>
          <MaterialIcons name="notifications-active" size={22} color={Colors.primary} />
          <Text style={styles.bannerText}>
            {pendingMerchantCount === 1
              ? '1 pedido pago aguarda sua confirmação'
              : `${pendingMerchantCount} pedidos aguardam confirmação`}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={sortedDeliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 16, gap: Spacing.sm, paddingTop: Spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
            <Text style={styles.emptySubText}>Pedidos do app e entregas aparecem aqui</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = statusForCard(item);
          const showActions = needsMerchantAction(item);
          return (
            <View style={[styles.card, showActions && styles.cardUrgent]}>
              <TouchableOpacity
                style={styles.cardTap}
                onPress={() => router.push(`/delivery/${item.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.customerName}>{item.customer_name}</Text>
                  <View style={[styles.badge, { backgroundColor: st.color + '22' }]}>
                    <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardAddress}>
                  {item.customer_address}, {item.customer_address_number} — {item.customer_neighborhood}
                </Text>
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
              {showActions ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnReject]}
                    onPress={() => onReject(item.id)}
                    disabled={actingId === item.id}
                    activeOpacity={0.85}
                  >
                    {actingId === item.id ? (
                      <ActivityIndicator color={Colors.error} size="small" />
                    ) : (
                      <Text style={styles.btnRejectText}>Recusar (estorno)</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnAccept]}
                    onPress={() => onAccept(item.id)}
                    disabled={actingId === item.id}
                    activeOpacity={0.85}
                  >
                    {actingId === item.id ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.btnAcceptText}>Aceitar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.primary + '18',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  bannerText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardUrgent: { borderColor: Colors.primary + '88' },
  cardTap: { padding: Spacing.md },
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
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  btn: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnReject: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.error + '55' },
  btnRejectText: { fontWeight: '800', color: Colors.error, fontSize: FontSize.sm },
  btnAccept: { backgroundColor: Colors.primary },
  btnAcceptText: { fontWeight: '800', color: Colors.white, fontSize: FontSize.sm },
  empty: { alignItems: 'center', paddingVertical: 64, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
