import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getAllDeliveries } from '@/services/deliveryService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatDate } from '@/utils/links';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'delivered' | 'cancelled';
type PeriodFilter = 'today' | 'week' | 'month' | 'all';

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'delivered', label: 'Entregues' },
  { key: 'cancelled', label: 'Cancelados' },
];

const PERIOD_FILTERS: { key: PeriodFilter; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: '30 dias' },
  { key: 'all', label: 'Total' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendente',      color: Colors.warning, bg: Colors.warning + '22' },
  assigned:  { label: 'A caminho',     color: Colors.info,    bg: Colors.info    + '22' },
  collected: { label: 'Coletado',      color: Colors.secondary, bg: Colors.secondary + '22' },
  delivered: { label: 'Entregue',      color: Colors.success, bg: Colors.success + '22' },
  cancelled: { label: 'Cancelado',     color: Colors.error,   bg: Colors.error   + '22' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodStart(period: PeriodFilter): Date | null {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

function matchesStatus(delivery: Delivery, filter: FilterStatus): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return delivery.status === 'pending';
  if (filter === 'delivered') return delivery.status === 'delivered';
  if (filter === 'in_progress') return ['assigned', 'collected'].includes(delivery.status ?? '');
  if (filter === 'cancelled') return delivery.status === 'cancelled';
  return true;
}

function matchesPeriod(delivery: Delivery, period: PeriodFilter): boolean {
  const start = periodStart(period);
  if (!start) return true;
  return new Date(delivery.created_at) >= start;
}

function computeRevenue(deliveries: Delivery[], period: PeriodFilter): number {
  const start = periodStart(period);
  return deliveries
    .filter((d) => d.status === 'delivered' && (start ? new Date(d.created_at) >= start : true))
    .reduce((sum, d) => sum + Number(d.price ?? 0), 0);
}

function computeCancellations(deliveries: Delivery[], period: PeriodFilter): number {
  const start = periodStart(period);
  return deliveries.filter(
    (d) => d.status === 'cancelled' && (start ? new Date(d.created_at) >= start : true)
  ).length;
}

// ─── Summary Bar ─────────────────────────────────────────────────────────────

function SummaryBar({
  filtered,
  total,
  revenue,
  cancellations,
  period,
}: {
  filtered: number;
  total: number;
  revenue: number;
  cancellations: number;
  period: PeriodFilter;
}) {
  const periodLabel = PERIOD_FILTERS.find((p) => p.key === period)?.label ?? '';
  return (
    <View style={summaryStyles.bar}>
      <View style={summaryStyles.item}>
        <Text style={summaryStyles.value}>{filtered}</Text>
        <Text style={summaryStyles.label}>de {total} entregas</Text>
      </View>
      <View style={summaryStyles.divider} />
      <View style={summaryStyles.item}>
        <Text style={[summaryStyles.value, { color: Colors.success }]}>{formatCurrency(revenue)}</Text>
        <Text style={summaryStyles.label}>faturado ({periodLabel})</Text>
      </View>
      <View style={summaryStyles.divider} />
      <View style={summaryStyles.item}>
        <Text style={[summaryStyles.value, { color: cancellations > 0 ? Colors.error : Colors.textMuted }]}>
          {cancellations}
        </Text>
        <Text style={summaryStyles.label}>cancelamentos</Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },
  value: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  label: { fontSize: FontSize.xs, color: Colors.textMuted },
});

// ─── Delivery Row ─────────────────────────────────────────────────────────────

function DeliveryRow({ item }: { item: Delivery }) {
  const biz = (item as any).businesses;
  const mb  = (item as any).motoboys;
  const st  = STATUS_LABELS[item.status ?? 'pending'] ?? STATUS_LABELS['pending'];
  const isCancelled = item.status === 'cancelled';

  return (
    <View style={[rowStyles.row, isCancelled && rowStyles.rowCancelled]}>
      <View style={rowStyles.top}>
        <View style={rowStyles.leftTop}>
          <Text style={rowStyles.customerName} numberOfLines={1}>{item.customer_name}</Text>
          <Text style={rowStyles.address} numberOfLines={1}>
            {item.customer_neighborhood}, {item.customer_city}
          </Text>
        </View>
        <View style={[rowStyles.badge, { backgroundColor: st.bg }]}>
          <Text style={[rowStyles.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <View style={rowStyles.meta}>
        {biz?.name ? (
          <View style={rowStyles.metaItem}>
            <MaterialIcons name="store" size={13} color={Colors.textMuted} />
            <Text style={rowStyles.metaText} numberOfLines={1}>{biz.name}</Text>
          </View>
        ) : null}
        {mb?.name ? (
          <View style={rowStyles.metaItem}>
            <MaterialIcons name="two-wheeler" size={13} color={Colors.textMuted} />
            <Text style={rowStyles.metaText} numberOfLines={1}>{mb.name}</Text>
          </View>
        ) : null}
        <View style={rowStyles.metaItem}>
          <MaterialIcons name="straighten" size={13} color={Colors.textMuted} />
          <Text style={rowStyles.metaText}>{item.distance_km} km</Text>
        </View>
      </View>

      <View style={rowStyles.bottom}>
        <Text style={rowStyles.date}>{formatDate(item.created_at)}</Text>
        <Text style={rowStyles.price}>{formatCurrency(Number(item.price ?? 0))}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  leftTop: { flex: 1 },
  customerName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  address: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted, maxWidth: 120 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },
  price: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  rowCancelled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    opacity: 0.75,
  },
});

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function Chip({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[chipStyles.chip, selected && chipStyles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[chipStyles.text, selected && chipStyles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  textSelected: { color: Colors.white, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminDeliveriesScreen() {
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const insets = useSafeAreaInsets();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const data = await getAllDeliveries();
    setAllDeliveries(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = allDeliveries.filter(
    (d) => matchesStatus(d, statusFilter) && matchesPeriod(d, periodFilter)
  );

  const revenue = computeRevenue(allDeliveries, periodFilter);
  const cancellations = computeCancellations(allDeliveries, periodFilter);

  const ListHeader = (
    <View>
      {/* Summary */}
      <SummaryBar
        filtered={filtered.length}
        total={allDeliveries.length}
        revenue={revenue}
        cancellations={cancellations}
        period={periodFilter}
      />

      {/* Period filter */}
      <Text style={styles.filterLabel}>Período</Text>
      <View style={styles.chipRow}>
        {PERIOD_FILTERS.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            selected={periodFilter === p.key}
            onPress={() => setPeriodFilter(p.key)}
          />
        ))}
      </View>

      {/* Status filter */}
      <Text style={styles.filterLabel}>Status</Text>
      <View style={[styles.chipRow, { marginBottom: Spacing.md }]}>
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            selected={statusFilter === s.key}
            onPress={() => setStatusFilter(s.key)}
          />
        ))}
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
        <Text style={styles.pageTitle}>Entregas</Text>
        <TouchableOpacity
          onPress={() => load(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
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
            <Text style={styles.emptyText}>Nenhuma entrega encontrada</Text>
            <Text style={styles.emptySubText}>Tente ajustar os filtros de período ou status</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
  },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  filterLabel: {
    fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textSecondary },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
