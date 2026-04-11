import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getAdminSalesDeliveries } from '@/services/deliveryService';
import { getAppConfig } from '@/services/configService';
import type { Delivery } from '@/types';
import {
  parseBillingConfig,
  settlementForDelivery,
  sumSettlements,
  type SalesSettlementRow,
} from '@/utils/salesSettlement';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';

function aggregateByBusiness(rows: SalesSettlementRow[]) {
  const map = new Map<string, SalesSettlementRow[]>();
  for (const r of rows) {
    const k = r.businessName;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, list, totals: sumSettlements(list) }))
    .sort((a, b) => b.totals.gross - a.totals.gross);
}

export default function AdminSalesReportScreen() {
  const insets = useSafeAreaInsets();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [billingJson, setBillingJson] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedBiz, setExpandedBiz] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, cfg] = await Promise.all([getAdminSalesDeliveries(), getAppConfig()]);
    setDeliveries(d);
    setBillingJson(cfg.billing_config ?? '');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const billing = useMemo(() => parseBillingConfig(billingJson), [billingJson]);

  const rows = useMemo(() => {
    const out: SalesSettlementRow[] = [];
    for (const d of deliveries) {
      const s = settlementForDelivery(d, billing);
      if (s) out.push(s);
    }
    return out;
  }, [deliveries, billing]);

  const totals = useMemo(() => sumSettlements(rows), [rows]);

  const appPaidRows = useMemo(() => rows.filter((r) => r.paidOnline), [rows]);
  const appPaidTotals = useMemo(() => sumSettlements(appPaidRows), [appPaidRows]);

  const byBusiness = useMemo(() => aggregateByBusiness(rows), [rows]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: Spacing.md,
        paddingBottom: insets.bottom + 32,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={Colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Relatório de vendas</Text>
      <Text style={styles.sub}>
        Valores calculados pelo app conforme o plano de cada comércio (básico ou entrega) e as taxas em Config →
        cobrança comércios.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Todas as entregas (exceto canceladas)</Text>
        <Text style={styles.cardHint}>{totals.count} pedidos com valor &gt; 0</Text>
        <Row label="Faturamento bruto" value={totals.gross} bold />
        <Row label="Retenção do app (comissão + taxa/pedido)" value={totals.appShare} accent />
        <Row label="Taxa gateway estimada (MP, só app pago)" value={totals.mpFeeEstimate} muted />
        <Row label="Líquido comércio (estimado)" value={totals.merchantNet} success />
        <View style={styles.divider} />
        <Text style={styles.detail}>
          Comissão: {formatCurrency(totals.commissionAmount)} · Taxa fixa/pedido app:{' '}
          {formatCurrency(totals.serviceFee)}
        </Text>
      </View>

      <View style={[styles.card, styles.cardAlt]}>
        <MaterialIcons name="phone-android" size={22} color={Colors.primary} />
        <Text style={styles.cardTitle}>Só pedidos app com pagamento online confirmado</Text>
        <Text style={styles.cardHint}>
          {appPaidTotals.count} pedidos — base ideal para conferir repasse após Pix manual / MP
        </Text>
        <Row label="Bruto" value={appPaidTotals.gross} bold />
        <Row label="Retenção app" value={appPaidTotals.appShare} accent />
        <Row label="Taxa MP estimada" value={appPaidTotals.mpFeeEstimate} muted />
        <Row label="Líquido comércio" value={appPaidTotals.merchantNet} success />
      </View>

      <Text style={styles.section}>Por comércio</Text>
      {byBusiness.length === 0 ? (
        <Text style={styles.empty}>Nenhuma venda no período carregado.</Text>
      ) : (
        byBusiness.map(({ name, list, totals: t }) => {
          const open = expandedBiz === name;
          return (
            <View key={name} style={styles.bizCard}>
              <TouchableOpacity
                style={styles.bizHeader}
                onPress={() => setExpandedBiz(open ? null : name)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bizName}>{name}</Text>
                  <Text style={styles.bizMeta}>
                    {t.count} pedidos · {list.filter((r) => r.paidOnline).length} app pagos
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bizGross}>{formatCurrency(t.gross)}</Text>
                  <Text style={styles.bizNet}>Líq. {formatCurrency(t.merchantNet)}</Text>
                </View>
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={Colors.textMuted} />
              </TouchableOpacity>
              {open ? (
                <View style={styles.bizBody}>
                  <Row label="Bruto" value={t.gross} small />
                  <Row label="App" value={t.appShare} small accent />
                  <Row label="MP est." value={t.mpFeeEstimate} small muted />
                  <Row label="Comércio" value={t.merchantNet} small success />
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Como o app calcula</Text>
        <Text style={styles.legendText}>
          • <Text style={styles.legendBold}>Bruto</Text>: valor total do pedido (`price`).
        </Text>
        <Text style={styles.legendText}>
          • <Text style={styles.legendBold}>Comissão</Text>: % do plano do comércio sobre o subtotal dos itens (app) ou
          sobre o total se não houver subtotal.
        </Text>
        <Text style={styles.legendText}>
          • <Text style={styles.legendBold}>Taxa por pedido</Text>: valor fixo (`service_fee_per_order`) só em pedidos
          pelo app.
        </Text>
        <Text style={styles.legendText}>
          • <Text style={styles.legendBold}>Taxa gateway</Text>: média entre min e max % do plano, aplicada só quando o
          pedido é app e está pago online (Mercado Pago). Pix manual fora do MP = não entra nessa estimativa.
        </Text>
        <Text style={styles.legendText}>
          • <Text style={styles.legendBold}>Líquido comércio</Text>: bruto − retenção do app − taxa MP estimada.
        </Text>
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
  muted,
  success,
  small,
}: {
  label: string;
  value: number;
  bold?: boolean;
  accent?: boolean;
  muted?: boolean;
  success?: boolean;
  small?: boolean;
}) {
  const color = success ? Colors.success : accent ? Colors.secondary : muted ? Colors.textMuted : Colors.text;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, small && styles.rowLabelSmall]}>{label}</Text>
      <Text style={[styles.rowValue, small && styles.rowValueSmall, bold && styles.rowValueBold, { color }]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardAlt: { borderColor: Colors.primary + '44' },
  cardTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  rowLabelSmall: { fontSize: FontSize.xs },
  rowValue: { fontSize: FontSize.md, fontWeight: '700' },
  rowValueSmall: { fontSize: FontSize.sm },
  rowValueBold: { fontSize: FontSize.lg },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  detail: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  section: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  empty: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  bizCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  bizHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  bizName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  bizMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  bizGross: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text },
  bizNet: { fontSize: FontSize.xs, color: Colors.success, marginTop: 2 },
  bizBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  legend: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  legendBold: { fontWeight: '700', color: Colors.text },
});
