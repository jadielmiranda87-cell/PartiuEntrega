import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getMotoboyHistory } from '@/services/deliveryService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate } from '@/utils/links';

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthLabel(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function computeStats(deliveries: Delivery[]) {
  const monthStart = startOfCurrentMonth();
  const thisMonth = deliveries.filter(
    (d) => d.delivered_at && new Date(d.delivered_at) >= monthStart
  );
  const totalEarnings = thisMonth.reduce((sum, d) => sum + Number(d.price ?? 0), 0);
  const count = thisMonth.length;
  const average = count > 0 ? totalEarnings / count : 0;
  return { totalEarnings, count, average };
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconColor,
  label,
  value,
  accent,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[statStyles.card, accent && statStyles.accentCard]}>
      <View style={[statStyles.iconBg, { backgroundColor: iconColor + '22' }]}>
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accentCard: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primary + '11',
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

// ─── Delivery Row ─────────────────────────────────────────────────────────────

function DeliveryRow({ item }: { item: Delivery }) {
  const biz = (item as any).businesses;
  const isThisMonth =
    item.delivered_at && new Date(item.delivered_at) >= startOfCurrentMonth();

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <View style={[rowStyles.dot, isThisMonth ? rowStyles.dotActive : rowStyles.dotMuted]} />
        <View style={{ flex: 1 }}>
          <Text style={rowStyles.destination} numberOfLines={1}>
            {item.customer_neighborhood}, {item.customer_city}
          </Text>
          <Text style={rowStyles.business} numberOfLines={1}>
            {biz?.name ?? 'Comércio'}
          </Text>
          <Text style={rowStyles.date}>
            {item.delivered_at ? formatDate(item.delivered_at) : '—'}
          </Text>
        </View>
      </View>
      <View style={rowStyles.right}>
        <Text style={rowStyles.price}>{formatCurrency(Number(item.price ?? 0))}</Text>
        <Text style={rowStyles.km}>{item.distance_km} km</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  dotActive: { backgroundColor: Colors.success },
  dotMuted: { backgroundColor: Colors.textMuted },
  destination: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  business: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  date: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  right: { alignItems: 'flex-end', gap: 2 },
  price: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primary,
  },
  km: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { motoboyProfile } = useAppAuth();
  const insets = useSafeAreaInsets();

  const load = useCallback(async (isRefresh = false) => {
    if (!motoboyProfile) return;
    if (isRefresh) setRefreshing(true);
    const data = await getMotoboyHistory(motoboyProfile.id);
    setDeliveries(data);
    setLoading(false);
    setRefreshing(false);
  }, [motoboyProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { totalEarnings, count, average } = computeStats(deliveries);

  const ListHeader = (
    <View>
      {/* Month label */}
      <View style={styles.monthRow}>
        <MaterialIcons name="calendar-today" size={16} color={Colors.textMuted} />
        <Text style={styles.monthLabel}>Resumo de {monthLabel()}</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="attach-money"
          iconColor={Colors.primary}
          label="Ganhos no mês"
          value={formatCurrency(totalEarnings)}
          accent
        />
        <StatCard
          icon="motorcycle"
          iconColor={Colors.secondary}
          label="Corridas concluídas"
          value={String(count)}
        />
      </View>
      <View style={[styles.statsGrid, { marginTop: Spacing.sm }]}>
        <StatCard
          icon="trending-up"
          iconColor={Colors.success}
          label="Valor médio/corrida"
          value={formatCurrency(average)}
        />
        <StatCard
          icon="history"
          iconColor={Colors.info}
          label="Total histórico"
          value={String(deliveries.length)}
        />
      </View>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Últimas 50 Entregas</Text>
        <Text style={styles.sectionSub}>{deliveries.length} registradas</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Meus Ganhos</Text>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhuma entrega concluída</Text>
            <Text style={styles.emptySubText}>Suas corridas entregues aparecerão aqui</Text>
          </View>
        }
        renderItem={({ item }) => <DeliveryRow item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text,
  },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: Spacing.md,
  },
  monthLabel: {
    fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500',
    textTransform: 'capitalize',
  },
  statsGrid: {
    flexDirection: 'row', gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.text,
  },
  sectionSub: {
    fontSize: FontSize.xs, color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center', paddingVertical: 60, gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary,
  },
  emptySubText: {
    fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center',
  },
});
