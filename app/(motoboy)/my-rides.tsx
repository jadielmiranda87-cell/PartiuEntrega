import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getMotoboyDeliveries, getMotoboyHistory } from '@/services/deliveryService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate } from '@/utils/links';

export default function MyRidesScreen() {
  const [active, setActive] = useState<Delivery[]>([]);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const { motoboyProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadData = useCallback(async () => {
    if (!motoboyProfile?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [a, h] = await Promise.all([
        getMotoboyDeliveries(motoboyProfile.id),
        getMotoboyHistory(motoboyProfile.id),
      ]);
      setActive(a || []);
      setHistory(h || []);
    } catch (e) {
      console.error('[MyRides] Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [motoboyProfile?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const list = tab === 'active' ? active : history;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondary} /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.pageTitle}>Minhas Corridas</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Em andamento ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Histórico ({history.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 16, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.secondary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="local-shipping" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{tab === 'active' ? 'Nenhuma corrida ativa' : 'Histórico vazio'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const biz = (item as any).businesses;
          const statusColor = item.status === 'assigned' ? Colors.info : item.status === 'collected' ? Colors.primary : Colors.success;
          const statusLabel = item.status === 'assigned' ? 'Indo buscar' : item.status === 'collected' ? 'Entregando' : 'Entregue';
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => item.status !== 'delivered' ? router.push(`/ride/${item.id}`) : null}
              activeOpacity={item.status !== 'delivered' ? 0.8 : 1}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{item.customer_name}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              {biz?.name && <Text style={styles.bizName}><MaterialIcons name="store" size={12} color={Colors.textMuted} /> {biz.name}</Text>}
              <Text style={styles.address}>{item.customer_address}, {item.customer_address_number}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.price}>{formatCurrency(item.price)}</Text>
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              </View>
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
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginBottom: Spacing.md },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.secondary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Colors.white },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  customerName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1 },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  bizName: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  address: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  price: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: 64, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
