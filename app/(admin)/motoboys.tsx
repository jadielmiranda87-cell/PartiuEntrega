import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Pressable,
  TextInput, Image, Linking,
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
import {
  adminApproveVerification,
  adminRejectVerification,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_STATUS_COLOR,
} from '@/services/documentService';
import { awardReferralCashback } from '@/services/cashbackService';
import { getAppConfig } from '@/services/configService';
import { Motoboy, Subscription, VerificationStatus } from '@/types';
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

// ─── Document Viewer Modal ────────────────────────────────────────────────────

function DocumentModal({
  visible,
  motoboy,
  onClose,
  onApprove,
  onReject,
}: {
  visible: boolean;
  motoboy: Motoboy | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const insets = useSafeAreaInsets();

  const vStatus = (motoboy?.verification_status as VerificationStatus) ?? 'pending_documents';
  const statusColor = VERIFICATION_STATUS_COLOR[vStatus] ?? Colors.textMuted;
  const statusLabel = VERIFICATION_STATUS_LABEL[vStatus] ?? vStatus;

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onReject(rejectReason.trim());
    setRejectReason('');
    setRejecting(false);
  };

  if (!motoboy) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={docModalStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[docModalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={docModalStyles.handle} />

          {/* Header */}
          <View style={docModalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={docModalStyles.title} numberOfLines={1}>{motoboy.name}</Text>
              <View style={[docModalStyles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
                <Text style={[docModalStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* CNH Type */}
            <View style={docModalStyles.section}>
              <Text style={docModalStyles.sectionTitle}>
                Tipo de CNH: {motoboy.cnh_type === 'digital' ? 'Digital (PDF)' : 'Física (Frente + Verso)'}
              </Text>

              {motoboy.cnh_type === 'physical' ? (
                <View style={{ gap: Spacing.md }}>
                  {motoboy.cnh_front_url ? (
                    <DocImageView
                      label="CNH Frente"
                      uri={motoboy.cnh_front_url}
                      hasError={!!imgError['front']}
                      onError={() => setImgError((p) => ({ ...p, front: true }))}
                    />
                  ) : (
                    <MissingDoc label="CNH Frente" />
                  )}
                  {motoboy.cnh_back_url ? (
                    <DocImageView
                      label="CNH Verso"
                      uri={motoboy.cnh_back_url}
                      hasError={!!imgError['back']}
                      onError={() => setImgError((p) => ({ ...p, back: true }))}
                    />
                  ) : (
                    <MissingDoc label="CNH Verso" />
                  )}
                </View>
              ) : motoboy.cnh_pdf_url ? (
                <TouchableOpacity
                  style={docModalStyles.pdfBtn}
                  onPress={() => Linking.openURL(motoboy.cnh_pdf_url!)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="picture-as-pdf" size={24} color={Colors.error} />
                  <Text style={docModalStyles.pdfBtnText}>Abrir PDF da CNH Digital</Text>
                  <MaterialIcons name="open-in-new" size={16} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <MissingDoc label="CNH Digital PDF" />
              )}
            </View>

            {/* Selfie */}
            <View style={docModalStyles.section}>
              <Text style={docModalStyles.sectionTitle}>Selfie</Text>
              {motoboy.selfie_url ? (
                <DocImageView
                  label="Selfie"
                  uri={motoboy.selfie_url}
                  hasError={!!imgError['selfie']}
                  onError={() => setImgError((p) => ({ ...p, selfie: true }))}
                  square
                />
              ) : (
                <MissingDoc label="Selfie" />
              )}
            </View>

            {/* LGPD */}
            <View style={docModalStyles.section}>
              <Text style={docModalStyles.sectionTitle}>Consentimento LGPD</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons
                  name={motoboy.lgpd_consent ? 'check-circle' : 'cancel'}
                  size={20}
                  color={motoboy.lgpd_consent ? Colors.success : Colors.error}
                />
                <Text style={{ fontSize: FontSize.sm, color: motoboy.lgpd_consent ? Colors.success : Colors.error }}>
                  {motoboy.lgpd_consent
                    ? `Aceito em ${motoboy.lgpd_consent_at ? new Date(motoboy.lgpd_consent_at).toLocaleString('pt-BR') : '–'}`
                    : 'Não aceito'}
                </Text>
              </View>
            </View>

            {/* Rejection reason if rejected */}
            {vStatus === 'rejected' && motoboy.rejection_reason ? (
              <View style={docModalStyles.rejectionBox}>
                <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={docModalStyles.rejectionTitle}>Motivo da reprovação registrado:</Text>
                  <Text style={docModalStyles.rejectionText}>{motoboy.rejection_reason}</Text>
                </View>
              </View>
            ) : null}

            {/* Actions */}
            {(vStatus === 'under_review' || vStatus === 'pending_documents') ? (
              <View style={docModalStyles.actionSection}>
                {!rejecting ? (
                  <View style={docModalStyles.actionRow}>
                    <TouchableOpacity style={docModalStyles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
                      <MaterialIcons name="verified" size={18} color={Colors.white} />
                      <Text style={docModalStyles.approveBtnText}>Aprovar Documentos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={docModalStyles.rejectBtn}
                      onPress={() => setRejecting(true)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="cancel" size={18} color={Colors.error} />
                      <Text style={docModalStyles.rejectBtnText}>Reprovar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm }}>
                    <Text style={docModalStyles.rejectLabel}>Motivo da reprovação *</Text>
                    <TextInput
                      style={docModalStyles.rejectInput}
                      placeholder="Descreva o motivo da reprovação..."
                      placeholderTextColor={Colors.textMuted}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                    <View style={docModalStyles.actionRow}>
                      <TouchableOpacity
                        style={[docModalStyles.rejectConfirmBtn, !rejectReason.trim() && { opacity: 0.5 }]}
                        onPress={handleReject}
                        disabled={!rejectReason.trim()}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="cancel" size={16} color={Colors.white} />
                        <Text style={docModalStyles.rejectConfirmText}>Confirmar Reprovação</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={docModalStyles.cancelBtn}
                        onPress={() => { setRejecting(false); setRejectReason(''); }}
                        activeOpacity={0.8}
                      >
                        <Text style={docModalStyles.cancelBtnText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {/* Re-approve if previously rejected */}
            {vStatus === 'rejected' ? (
              <View style={docModalStyles.actionSection}>
                <TouchableOpacity style={docModalStyles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
                  <MaterialIcons name="verified" size={18} color={Colors.white} />
                  <Text style={docModalStyles.approveBtnText}>Aprovar mesmo assim</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DocImageView({
  label, uri, hasError, onError, square,
}: {
  label: string; uri: string; hasError: boolean; onError: () => void; square?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={docModalStyles.docLabel}>{label}</Text>
      {hasError ? (
        <View style={[docModalStyles.imgPlaceholder, square && { height: 220 }]}>
          <MaterialIcons name="broken-image" size={32} color={Colors.textMuted} />
          <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 }}>
            Não foi possível carregar a imagem
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(uri)}
            style={{ marginTop: 8 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600' }}>
              Abrir no navegador
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={[docModalStyles.docImage, square && { height: 220, borderRadius: 110 }]}
          resizeMode="contain"
          onError={onError}
        />
      )}
    </View>
  );
}

function MissingDoc({ label }: { label: string }) {
  return (
    <View style={docModalStyles.missingDoc}>
      <MaterialIcons name="warning" size={20} color={Colors.warning} />
      <Text style={docModalStyles.missingDocText}>{label} não enviado</Text>
    </View>
  );
}

const docModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, maxHeight: '92%',
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
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 4,
    borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  section: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  docLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  docImage: {
    width: '100%', height: 180, borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  imgPlaceholder: {
    width: '100%', height: 180, borderRadius: BorderRadius.md,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  missingDoc: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning + '15', borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '44',
  },
  missingDocText: { fontSize: FontSize.sm, color: Colors.warning },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.error + '15', borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.error + '44',
  },
  pdfBtnText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  rejectionBox: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.error + '15', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  rejectionTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.error, marginBottom: 3 },
  rejectionText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  actionSection: { marginBottom: Spacing.lg, gap: Spacing.sm },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  approveBtn: {
    flex: 1, flexDirection: 'row', gap: 6, backgroundColor: Colors.success,
    borderRadius: BorderRadius.md, height: 46, alignItems: 'center', justifyContent: 'center',
  },
  approveBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  rejectBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: Colors.error + '22',
    borderRadius: BorderRadius.md, height: 46, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.error + '44',
  },
  rejectBtnText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.sm },
  rejectLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  rejectInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    padding: Spacing.md, color: Colors.text, fontSize: FontSize.sm,
    borderWidth: 1, borderColor: Colors.border, minHeight: 80,
  },
  rejectConfirmBtn: {
    flex: 1, flexDirection: 'row', gap: 6, backgroundColor: Colors.error,
    borderRadius: BorderRadius.md, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  rejectConfirmText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  cancelBtn: {
    paddingHorizontal: Spacing.md, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.sm },
});

// ─── Report Modal ─────────────────────────────────────────────────────────────

type Report = {
  totalRides: number;
  monthEarnings: number;
  lastActivity: string | null;
  paidSubscriptions: Subscription[];
};

function ReportModal({
  visible, motoboy, onClose,
}: { visible: boolean; motoboy: Motoboy | null; onClose: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    if (!motoboy) return;
    setLoading(true);
    setReport(null);
    const data = await getMotoboyReport(motoboy.id);
    setReport(data);
    setLoading(false);
  }, [motoboy]);

  React.useEffect(() => { if (visible && motoboy) load(); }, [visible, motoboy]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title} numberOfLines={1}>{motoboy?.name ?? ''}</Text>
              <Text style={modalStyles.subtitle}>
                {motoboy?.moto_brand} {motoboy?.moto_model} • {motoboy?.moto_plate}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
              <View style={modalStyles.statsRow}>
                <ReportStat icon="motorcycle" color={Colors.secondary} label="Corridas concluídas" value={String(report.totalRides)} />
                <ReportStat icon="attach-money" color={Colors.primary} label={`Ganhos em ${monthLabel}`} value={formatCurrency(report.monthEarnings)} accent />
              </View>
              <View style={[modalStyles.statsRow, { marginTop: Spacing.sm }]}>
                <ReportStat icon="event" color={Colors.info} label="Última atividade" value={report.lastActivity ? formatDate(report.lastActivity) : 'Nenhuma'} />
                <ReportStat icon="receipt" color={Colors.success} label="Assinaturas pagas" value={String(report.paidSubscriptions.length)} />
              </View>
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>Histórico de Assinaturas Pagas</Text>
                {report.paidSubscriptions.length === 0 ? (
                  <View style={modalStyles.emptyBox}>
                    <MaterialIcons name="receipt-long" size={32} color={Colors.textMuted} />
                    <Text style={modalStyles.emptyText}>Nenhuma assinatura paga</Text>
                  </View>
                ) : report.paidSubscriptions.map((sub, idx) => (
                  <View key={sub.id} style={[modalStyles.subRow, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={modalStyles.subLeft}>
                      <View style={modalStyles.subIndexBadge}>
                        <Text style={modalStyles.subIndexText}>#{report.paidSubscriptions.length - idx}</Text>
                      </View>
                      <View>
                        <Text style={modalStyles.subDate}>{formatDate(sub.created_at)}</Text>
                        {sub.expires_at && (
                          <Text style={modalStyles.subExpiry}>Válido até {new Date(sub.expires_at).toLocaleDateString('pt-BR')}</Text>
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
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ReportStat({ icon, color, label, value, accent }: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']; color: string;
  label: string; value: string; accent?: boolean;
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
    borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  accent: { borderColor: Colors.primary + '55', backgroundColor: Colors.primary + '11' },
  iconBg: { width: 40, height: 40, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  label: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 14 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginTop: 12, marginBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  section: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginTop: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.6 },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  subLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  subIndexBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center' },
  subIndexText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  subDate: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  subExpiry: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  approvedTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  approvedTagText: { fontSize: 10, color: Colors.success, fontWeight: '600' },
  firstTag: { backgroundColor: Colors.info + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
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
  const [docMotoboy, setDocMotoboy] = useState<Motoboy | null>(null);
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

    if (mb.referred_by_motoboy_id) {
      const config = await getAppConfig();
      const cashbackAmount = parseFloat(config.cashback_per_motoboy_referral);
      if (cashbackAmount > 0) {
        await awardReferralCashback(
          mb.referred_by_motoboy_id, cashbackAmount,
          `Indicação aprovada: ${mb.name} se tornou motoboy`, mb.id
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
      { text: 'Suspender', style: 'destructive', onPress: async () => { await updateMotoboyStatus(mb.id, 'suspended'); loadData(); } },
    ]);
  };

  const handleReactivate = async (mb: Motoboy) => {
    await updateMotoboyStatus(mb.id, 'active');
    loadData();
  };

  const handleDocApprove = async () => {
    if (!docMotoboy) return;
    const { error } = await adminApproveVerification(docMotoboy.id);
    if (error) { showAlert('Erro', error); return; }
    showAlert('Aprovado!', 'Documentos verificados com sucesso.');
    setDocMotoboy(null);
    loadData();
  };

  const handleDocReject = async (reason: string) => {
    if (!docMotoboy) return;
    const { error } = await adminRejectVerification(docMotoboy.id, reason);
    if (error) { showAlert('Erro', error); return; }
    showAlert('Reprovado', 'O motoboy será notificado do motivo.');
    setDocMotoboy(null);
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
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 16, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.status] ?? Colors.textMuted;
          const label = STATUS_LABEL[item.status] ?? item.status;
          const isExpanded = expanded === item.id;
          const mbSubs = subs[item.id] ?? [];
          const vStatus = (item.verification_status as VerificationStatus) ?? 'pending_documents';
          const vColor = VERIFICATION_STATUS_COLOR[vStatus] ?? Colors.textMuted;
          const vLabel = VERIFICATION_STATUS_LABEL[vStatus] ?? vStatus;

          return (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => handleExpand(item.id)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mbName}>{item.name}</Text>
                    <Text style={styles.mbDetails}>{item.moto_brand} {item.moto_model} • {item.moto_plate}</Text>
                    <Text style={styles.mbDetails}>{item.city} - {item.state}</Text>
                    {/* Verification status chip */}
                    <View style={[styles.verBadge, { backgroundColor: vColor + '22', borderColor: vColor + '44' }]}>
                      <MaterialIcons
                        name={vStatus === 'approved' ? 'verified' : vStatus === 'rejected' ? 'cancel' : vStatus === 'under_review' ? 'hourglass-top' : 'upload-file'}
                        size={11} color={vColor}
                      />
                      <Text style={[styles.verBadgeText, { color: vColor }]}>{vLabel}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.badgeText, { color }]}>{label}</Text>
                    </View>
                    <TouchableOpacity style={styles.reportBtn} onPress={() => setReportMotoboy(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialIcons name="bar-chart" size={14} color={Colors.primary} />
                      <Text style={styles.reportBtnText}>Relatório</Text>
                    </TouchableOpacity>
                    {/* Documents button */}
                    <TouchableOpacity
                      style={[styles.docsBtn, vStatus === 'under_review' && styles.docsBtnHighlight]}
                      onPress={() => setDocMotoboy(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="folder" size={14} color={vStatus === 'under_review' ? Colors.white : Colors.info} />
                      <Text style={[styles.docsBtnText, vStatus === 'under_review' && { color: Colors.white }]}>Documentos</Text>
                    </TouchableOpacity>
                    <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={22} color={Colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>

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
                    <DetailItem label="LGPD" value={item.lgpd_consent ? 'Aceito' : 'Pendente'} />
                    {item.delete_requested ? (
                      <DetailItem label="Exclusão solicitada" value={item.delete_requested_at ? new Date(item.delete_requested_at).toLocaleDateString('pt-BR') : 'Sim'} />
                    ) : null}
                  </View>

                  {mbSubs.length > 0 && (
                    <View style={styles.subsSection}>
                      <Text style={styles.subsSectionTitle}>Assinaturas</Text>
                      {mbSubs.map((sub) => (
                        <View key={sub.id} style={styles.subRow}>
                          <Text style={styles.subDate}>{formatDate(sub.created_at)}</Text>
                          <Text style={[styles.subStatus, { color: sub.payment_status === 'approved' ? Colors.success : Colors.warning }]}>
                            {sub.payment_status === 'approved' ? 'Pago' : 'Pendente'}{sub.admin_approved ? ' ✓ADM' : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.whatsappBtn} onPress={() => openWhatsApp(item.phone, 'Olá! Entrando em contato pelo FastFood ADM.')} activeOpacity={0.8}>
                      <MaterialIcons name="chat" size={16} color={Colors.white} />
                      <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    {item.status === 'pending_approval' && (
                      <TouchableOpacity style={[styles.approveBtn, approving === item.id && styles.btnDisabled]} onPress={() => handleApprove(item)} disabled={approving === item.id} activeOpacity={0.8}>
                        {approving === item.id ? <ActivityIndicator color={Colors.white} size="small" /> : (
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

      <ReportModal visible={reportMotoboy !== null} motoboy={reportMotoboy} onClose={() => setReportMotoboy(null)} />
      <DocumentModal
        visible={docMotoboy !== null}
        motoboy={docMotoboy}
        onClose={() => setDocMotoboy(null)}
        onApprove={handleDocApprove}
        onReject={handleDocReject}
      />
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: FontSize.sm, color: Colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md },
  mbName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  mbDetails: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  verBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, marginTop: 4,
  },
  verBadgeText: { fontSize: 10, fontWeight: '700' },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  reportBtnText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  docsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.info + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.info + '44',
  },
  docsBtnHighlight: { backgroundColor: Colors.info, borderColor: Colors.info },
  docsBtnText: { fontSize: 11, color: Colors.info, fontWeight: '700' },
  expandedSection: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: Spacing.md },
  detailGrid: { gap: 0 },
  subsSection: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, padding: Spacing.sm },
  subsSectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  subDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  subStatus: { fontSize: FontSize.xs, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  whatsappBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md,
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
