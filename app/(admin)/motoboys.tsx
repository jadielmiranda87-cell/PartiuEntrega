import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAlert } from '@/template';
import {
  getAllMotoboys,
  getMotoboySubscriptionsAdmin,
  approveMotoboySubscription,
  updateMotoboyStatus,
  getMotoboyReport,
} from '@/services/motoboyService';
import { awardReferralCashback } from '@/services/cashbackService';
import { getAppConfig } from '@/services/configService';
import { Motoboy, Subscription } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp, formatDate, formatCurrency } from '@/utils/links';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending_payment: Colors.warning,
  pending_approval: Colors.info,
  active: Colors.success,
  suspended: Colors.error,
};
const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Aguard. Pgto',
  pending_approval: 'Aguard. Aprovação',
  active: 'Ativo',
  suspended: 'Suspenso',
};

// ─── Report Modal ─────────────────────────────────────────────────────────────

type Report = {
  totalRides: number;
  monthEarnings: number;
  lastActivity: string | null;
  paidSubscriptions: Subscription[];
};

function ReportModal({
  visible,
  motoboy,
  onClose,
}: {
  visible: boolean;
  motoboy: Motoboy | null;
  onClose: () => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const monthLabel = new Date().toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  });

  const load = useCallback(async () => {
    if (!motoboy) return;
    setLoading(true);
    setReport(null);
    const data = await getMotoboyReport(motoboy.id);
    setReport(data);
    setLoading(false);
  }, [motoboy]);

  // Load when modal opens
  React.useEffect(() => {
    if (visible && motoboy) load();
  }, [visible, motoboy]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={modalStyles.handle} />

          {/* Header */}
          <View style={modalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title} numberOfLines={1}>
                {motoboy?.name ?? ''}
              </Text>
              <Text style={modalStyles.subtitle}>
                {motoboy?.moto_brand} {motoboy?.moto_model} • {motoboy?.moto_plate}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialIcons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={modalStyles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={modalStyles.loadingText}>Carregando relatório…</Text>
            </View>
          ) : report ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Stats row */}
              <View style={modalStyles.statsRow}>
                <ReportStat
                  icon="motorcycle"
                  color={Colors.secondary}
                  label="Corridas concluídas"
                  value={String(report.totalRides)}
                />
                <ReportStat
                  icon="attach-money"
                  color={Colors.primary}
                  label={`Ganhos em ${monthLabel}`}
                  value={formatCurrency(report.monthEarnings)}
                  accent
                />
              </View>

              <View style={[modalStyles.statsRow, { marginTop: Spacing.sm }]}>
                <ReportStat
                  icon="event"
                  color={Colors.info}
                  label="Última atividade"
                  value={report.lastActivity ? formatDate(report.lastActivity) : 'Nenhuma'}
                />
                <ReportStat
                  icon="receipt"
                  color={Colors.success}
                  label="Assinaturas pagas"
                  value={String(report.paidSubscriptions.length)}
                />
              </View>

              {/* Subscription history */}
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Histórico de Assinaturas Pagas</Text>
                {report.paidSubscriptions.length === 0 ? (
                  <View style={modalStyles.emptyBox}>
                    <MaterialIcons name="receipt-long" size={32} color={Colors.textMuted} />
                    <Text style={modalStyles.emptyText}>Nenhuma assinatura paga</Text>
                  </View>
                ) : (
                  report.paidSubscriptions.map((sub, idx) => (
                    <View key={sub.id} style={[modalStyles.subRow, idx === 0 && { borderTopWidth: 0 }]}>
                      <View style={modalStyles.subLeft}>
                        <View style={modalStyles.subIndexBadge}>
                          <Text style={modalStyles.subIndexText}>#{report.paidSubscriptions.length - idx}</Text>
                        </View>
                        <View>
                          <Text style={modalStyles.subDate}>{formatDate(sub.created_at)}</Text>
                          {sub.expires_at && (
                            <Text style={modalStyles.subExpiry}>
                              Válido até {new Date(sub.expires_at).toLocaleDateString('pt-BR')}
                            </Text>
                          )}
                          <View style={modalStyles.tagRow}>
                            {sub.admin_approved && (
                              <View style={modalStyles.approvedTag}>
                                <MaterialIcons name="verified" size={11} color={Colors.success} />
                                <Text style={modalStyles.approvedTagText}>ADM aprovado</Text>
                              </View>
                            )}
                            {sub.is_first_subscription && (
                              <View style={modalStyles.firstTag}>
                                <Text style={modalStyles.firstTagText}>1ª assinatura</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <Text style={modalStyles.subAmount}>{formatCurrency(Number(sub.amount ?? 0))}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ReportStat({
  icon, color, label, value, accent,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[reportStatStyles.card, accent && reportStatStyles.accent]}>
      <View style={[reportStatStyles.iconBg, { backgroundColor: color + '22' }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={reportStatStyles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={reportStatStyles.label}>{label}</Text>
    </View>
  );
}

const reportStatStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  accent: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primary + '11',
  },
  iconBg: {
    width: 40, height: 40, borderRadius: BorderRadius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  value: {
    fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, textAlign: 'center',
  },
  label: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 14,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: Colors.border,
    marginTop: 12, marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  section: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },
  subRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm,
  },
  subLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  subIndexBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  subIndexText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  subDate: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  subExpiry: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  approvedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.success + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  approvedTagText: { fontSize: 10, color: Colors.success, fontWeight: '600' },
  firstTag: {
    backgroundColor: Colors.info + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  firstTagText: { fontSize: 10, color: Colors.info, fontWeight: '600' },
  subAmount: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary, minWidth: 80, textAlign: 'right' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminMotoboysScreen() {
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subs, setSubs] = useState<Record<string, Subscription[]>>({});
  const [approving, setApproving] = useState<string | null>(null);
  const [reportMotoboy, setReportMotoboy] = useState<Motoboy | null>(null);
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async () => {
    const data = await getAllMotoboys();
    setMotoboys(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleExpand = async (mbId: string) => {
    if (expanded === mbId) { setExpanded(null); return; }
    setExpanded(mbId);
    if (!subs[mbId]) {
      const data = await getMotoboySubscriptionsAdmin(mbId);
      setSubs((prev) => ({ ...prev, [mbId]: data }));
    }
  };

  const handleApprove = async (mb: Motoboy) => {
    const mbSubs = subs[mb.id] ?? [];
    const pendingSub = mbSubs.find((s) => s.payment_status === 'approved' && !s.admin_approved);
    if (!pendingSub) {
      showAlert('Sem assinatura paga', 'Este motoboy ainda não tem pagamento confirmado.');
      return;
    }
    setApproving(mb.id);
    const expiresAt = pendingSub.expires_at ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await approveMotoboySubscription(pendingSub.id, mb.id, expiresAt);
    if (error) { setApproving(null); showAlert('Erro', error); return; }

    // Award cashback to referrer (if this motoboy was referred by another)
    if (mb.referred_by_motoboy_id) {
      const config = await getAppConfig();
      const cashbackAmount = parseFloat(config.cashback_per_motoboy_referral);
      if (cashbackAmount > 0) {
        await awardReferralCashback(
          mb.referred_by_motoboy_id,
          cashbackAmount,
          `Indicação aprovada: ${mb.name} se tornou motoboy`,
          mb.id
        );
      }
    }

    setApproving(null);
    showAlert('Aprovado!', `${mb.name} agora tem acesso às corridas.`);
    loadData();
  };

  const handleSuspend = (mb: Motoboy) => {
    showAlert(`Suspender ${mb.name}?`, 'O motoboy perderá acesso às corridas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Suspender', style: 'destructive', onPress: async () => {
          await updateMotoboyStatus(mb.id, 'suspended');
          loadData();
        }
      }
    ]);
  };

  const handleReactivate = async (mb: Motoboy) => {
    await updateMotoboyStatus(mb.id, 'active');
    loadData();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.pageTitle}>Motoboys ({motoboys.length})</Text>

      <FlatList
        data={motoboys}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingBottom: insets.bottom + 16,
          gap: Spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.status] ?? Colors.textMuted;
          const label = STATUS_LABEL[item.status] ?? item.status;
          const isExpanded = expanded === item.id;
          const mbSubs = subs[item.id] ?? [];

          return (
            <View style={styles.card}>
              {/* Card Header (tap to expand) */}
              <TouchableOpacity onPress={() => handleExpand(item.id)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mbName}>{item.name}</Text>
                    <Text style={styles.mbDetails}>{item.moto_brand} {item.moto_model} • {item.moto_plate}</Text>
                    <Text style={styles.mbDetails}>{item.city} - {item.state}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.badgeText, { color }]}>{label}</Text>
                    </View>
                    {/* Report button */}
                    <TouchableOpacity
                      style={styles.reportBtn}
                      onPress={() => setReportMotoboy(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="bar-chart" size={14} color={Colors.primary} />
                      <Text style={styles.reportBtnText}>Relatório</Text>
                    </TouchableOpacity>
                    <MaterialIcons
                      name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={22} color={Colors.textMuted}
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Expanded detail */}
              {isExpanded && (
                <View style={styles.expandedSection}>
                  <View style={styles.detailGrid}>
                    <DetailItem label="CPF" value={item.cpf} />
                    <DetailItem label="CNH" value={`${item.cnh_number} (${item.cnh_category})`} />
                    <DetailItem label="Telefone" value={item.phone} />
                    <DetailItem label="E-mail" value={item.email} />
                    <DetailItem label="Moto" value={`${item.moto_brand} ${item.moto_model} ${item.moto_year}`} />
                    <DetailItem label="Cadastro" value={formatDate(item.created_at)} />
                    {item.subscription_expires_at && (
                      <DetailItem label="Assinatura até" value={formatDate(item.subscription_expires_at)} />
                    )}
                  </View>

                  {mbSubs.length > 0 && (
                    <View style={styles.subsSection}>
                      <Text style={styles.subsSectionTitle}>Assinaturas</Text>
                      {mbSubs.map((sub) => (
                        <View key={sub.id} style={styles.subRow}>
                          <Text style={styles.subDate}>{formatDate(sub.created_at)}</Text>
                          <Text style={[
                            styles.subStatus,
                            { color: sub.payment_status === 'approved' ? Colors.success : Colors.warning }
                          ]}>
                            {sub.payment_status === 'approved' ? 'Pago' : 'Pendente'}
                            {sub.admin_approved ? ' ✓ADM' : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.whatsappBtn}
                      onPress={() => openWhatsApp(item.phone, 'Olá! Entrando em contato pelo MotoLink ADM.')}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="chat" size={16} color={Colors.white} />
                      <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    {item.status === 'pending_approval' && (
                      <TouchableOpacity
                        style={[styles.approveBtn, approving === item.id && styles.btnDisabled]}
                        onPress={() => handleApprove(item)}
                        disabled={approving === item.id}
                        activeOpacity={0.8}
                      >
                        {approving === item.id
                          ? <ActivityIndicator color={Colors.white} size="small" />
                          : (
                            <>
                              <MaterialIcons name="check" size={16} color={Colors.white} />
                              <Text style={styles.approveBtnText}>Aprovar</Text>
                            </>
                          )}
                      </TouchableOpacity>
                    )}

                    {item.status === 'active' && (
                      <TouchableOpacity style={styles.suspendBtn} onPress={() => handleSuspend(item)} activeOpacity={0.8}>
                        <MaterialIcons name="block" size={16} color={Colors.error} />
                        <Text style={styles.suspendBtnText}>Suspender</Text>
                      </TouchableOpacity>
                    )}

                    {item.status === 'suspended' && (
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleReactivate(item)} activeOpacity={0.8}>
                        <MaterialIcons name="check" size={16} color={Colors.white} />
                        <Text style={styles.approveBtnText}>Reativar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Individual Report Modal */}
      <ReportModal
        visible={reportMotoboy !== null}
        motoboy={reportMotoboy}
        onClose={() => setReportMotoboy(null)}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: FontSize.sm, color: Colors.text }}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  pageTitle: {
    fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md },
  mbName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  mbDetails: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  reportBtnText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  expandedSection: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: Spacing.md, gap: Spacing.md,
  },
  detailGrid: { gap: 0 },
  subsSection: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md, padding: Spacing.sm,
  },
  subsSectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700',
    color: Colors.textSecondary, marginBottom: 6,
  },
  subRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
  },
  subDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  subStatus: { fontSize: FontSize.xs, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  whatsappBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 40, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: Spacing.md,
  },
  whatsappBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  approveBtn: {
    flex: 1, flexDirection: 'row', gap: 6, backgroundColor: Colors.success,
    borderRadius: BorderRadius.md, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  approveBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  suspendBtn: {
    flex: 1, flexDirection: 'row', gap: 6, backgroundColor: Colors.error + '22',
    borderRadius: BorderRadius.md, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  suspendBtnText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.sm },
});
