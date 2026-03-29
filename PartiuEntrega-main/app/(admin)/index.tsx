import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getAllMotoboys, getPendingApprovalMotoboys } from '@/services/motoboyService';
import { getAllDeliveries } from '@/services/deliveryService';
import { getAllBusinesses } from '@/services/businessService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState({ motoboys: 0, businesses: 0, deliveries: 0, pending: 0, revenue: 0 });
  const [pendingMotoboys, setPendingMotoboys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadData = useCallback(async () => {
    const [motoboys, businesses, deliveries, pending] = await Promise.all([
      getAllMotoboys(),
      getAllBusinesses(),
      getAllDeliveries(),
      getPendingApprovalMotoboys(),
    ]);

    const revenue = deliveries
      .filter((d) => d.status === 'delivered')
      .reduce((sum, d) => sum + Number(d.price), 0);

    setStats({
      motoboys: motoboys.length,
      businesses: businesses.length,
      deliveries: deliveries.length,
      pending: deliveries.filter((d) => d.status === 'pending').length,
      revenue,
    });
    setPendingMotoboys(pending);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.adminBadge}>ADMINISTRADOR</Text>
          <Text style={styles.pageTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="logout" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {pendingMotoboys.length > 0 && (
        <TouchableOpacity style={styles.alertCard} onPress={() => router.push('/(admin)/motoboys')} activeOpacity={0.8}>
          <MaterialIcons name="warning" size={22} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{pendingMotoboys.length} motoboy(s) aguardando aprovação</Text>
            <Text style={styles.alertSub}>Toque para verificar e aprovar</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={Colors.warning} />
        </TouchableOpacity>
      )}

      <View style={styles.statsGrid}>
        <StatCard icon="two-wheeler" label="Motoboys" value={stats.motoboys} color={Colors.secondary} />
        <StatCard icon="store" label="Comércios" value={stats.businesses} color={Colors.info} />
        <StatCard icon="receipt" label="Entregas" value={stats.deliveries} color={Colors.primary} />
        <StatCard icon="hourglass-top" label="Pendentes" value={stats.pending} color={Colors.warning} />
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Faturamento Total (Entregas concluídas)</Text>
        <Text style={styles.revenueValue}>{formatCurrency(stats.revenue)}</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[statStyles.card, { borderTopColor: color, borderTopWidth: 3 }]}>
      <MaterialIcons name={icon as any} size={28} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4 },
  value: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md },
  adminBadge: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700', letterSpacing: 1 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#2a2000', borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.warning, marginBottom: Spacing.md,
  },
  alertTitle: { color: Colors.warning, fontWeight: '700', fontSize: FontSize.md },
  alertSub: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  revenueCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '44',
  },
  revenueLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  revenueValue: { fontSize: 36, fontWeight: '800', color: Colors.primary },
});
