import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_STATUS_COLOR,
  requestAccountDeletion,
} from '@/services/documentService';
import { useAlert } from '@/template';
import { VerificationStatus } from '@/types';

const APP_NAME = 'PartiuEntrega';
const SUPPORT_EMAIL = 'suporte@partiuentrega.com.br';

export default function PendingApprovalScreen() {
  const [loading, setLoading] = useState(false);
  const { refreshProfile, signOut, motoboyProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const verificationStatus: VerificationStatus =
    (motoboyProfile?.verification_status as VerificationStatus) ?? 'pending_documents';

  const handleRefresh = async () => {
    setLoading(true);
    await refreshProfile();
    setLoading(false);
    router.replace('/');
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleDeleteRequest = () => {
    showAlert(
      'Solicitar exclusão de dados',
      'Sua conta e todos os documentos serão excluídos. Esta ação não pode ser desfeita. Confirmar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar exclusão',
          style: 'destructive',
          onPress: async () => {
            if (!motoboyProfile?.id) return;
            const { error } = await requestAccountDeletion(motoboyProfile.id);
            if (error) {
              showAlert('Erro', error);
            } else {
              showAlert(
                'Solicitação enviada',
                'Seu pedido de exclusão foi registrado. Em até 15 dias úteis seus dados serão removidos.'
              );
            }
          },
        },
      ]
    );
  };

  const isRejected = verificationStatus === 'rejected';
  const isPendingDocs = verificationStatus === 'pending_documents';

  const statusColor = VERIFICATION_STATUS_COLOR[verificationStatus] ?? Colors.warning;
  const statusLabel = VERIFICATION_STATUS_LABEL[verificationStatus] ?? verificationStatus;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="logout" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Icon */}
        <View style={[styles.iconContainer, { backgroundColor: statusColor + '22' }]}>
          <MaterialIcons
            name={
              isRejected ? 'cancel' :
              isPendingDocs ? 'upload-file' :
              verificationStatus === 'approved' ? 'check-circle' :
              'hourglass-top'
            }
            size={64}
            color={statusColor}
          />
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Title & Message */}
        <Text style={styles.title}>
          {isRejected ? 'Cadastro Reprovado' :
           isPendingDocs ? 'Envie seus Documentos' :
           verificationStatus === 'approved' ? 'Cadastro Aprovado!' :
           'Aguardando Análise'}
        </Text>

        <Text style={styles.subtitle}>
          {isRejected
            ? 'Seu cadastro foi reprovado. Verifique o motivo abaixo, corrija os documentos e tente novamente.'
            : isPendingDocs
            ? 'Para liberar seu acesso às corridas, envie sua CNH e selfie no cadastro.'
            : verificationStatus === 'approved'
            ? 'Seu cadastro foi aprovado! Você já pode iniciar suas entregas.'
            : 'Seus documentos estão em análise. Você será notificado quando o processo for concluído.'}
        </Text>

        {/* Rejection Reason */}
        {isRejected && motoboyProfile?.rejection_reason ? (
          <View style={styles.rejectionCard}>
            <MaterialIcons name="error-outline" size={20} color={Colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectionTitle}>Motivo da reprovação:</Text>
              <Text style={styles.rejectionText}>{motoboyProfile.rejection_reason}</Text>
            </View>
          </View>
        ) : null}

        {/* Steps */}
        <View style={styles.stepsCard}>
          <StepItem
            icon="check-circle"
            color={Colors.success}
            text="Cadastro realizado"
            done
          />
          <StepItem
            icon="check-circle"
            color={Colors.success}
            text="Pagamento confirmado"
            done
          />
          <StepItem
            icon={isPendingDocs ? 'radio-button-unchecked' : 'check-circle'}
            color={isPendingDocs ? Colors.textMuted : Colors.success}
            text="Documentos enviados"
            done={!isPendingDocs}
            active={isPendingDocs}
          />
          <StepItem
            icon={
              verificationStatus === 'under_review' ? 'hourglass-top' :
              verificationStatus === 'approved' ? 'check-circle' :
              isRejected ? 'cancel' :
              'radio-button-unchecked'
            }
            color={
              verificationStatus === 'under_review' ? Colors.warning :
              verificationStatus === 'approved' ? Colors.success :
              isRejected ? Colors.error :
              Colors.textMuted
            }
            text="Verificação pelo ADM"
            done={verificationStatus === 'approved'}
            active={verificationStatus === 'under_review'}
          />
          <StepItem
            icon={verificationStatus === 'approved' ? 'check-circle' : 'radio-button-unchecked'}
            color={verificationStatus === 'approved' ? Colors.success : Colors.textMuted}
            text="Acesso liberado"
            done={verificationStatus === 'approved'}
          />
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[styles.refreshBtn, loading && styles.btnDisabled]}
          onPress={handleRefresh}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <MaterialIcons name="refresh" size={20} color={Colors.white} />
              <Text style={styles.refreshBtnText}>Verificar status</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Contact support */}
        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Duvida%20cadastro%20${APP_NAME}`)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="email" size={16} color={Colors.primary} />
          <Text style={styles.supportBtnText}>Contatar suporte</Text>
        </TouchableOpacity>

        {/* LGPD — data deletion */}
        <View style={styles.lgpdSection}>
          <Text style={styles.lgpdText}>
            Conforme a LGPD, você tem o direito de solicitar a exclusão dos seus dados pessoais a qualquer momento.
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteRequest} activeOpacity={0.7}>
            <MaterialIcons name="delete-forever" size={16} color={Colors.error} />
            <Text style={styles.deleteBtnText}>Solicitar exclusão de dados</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StepItem({
  icon, color, text, done, active,
}: {
  icon: string; color: string; text: string; done?: boolean; active?: boolean;
}) {
  return (
    <View style={stepStyles.row}>
      <MaterialIcons name={icon as any} size={22} color={color} />
      <Text style={[
        stepStyles.text,
        done ? stepStyles.textDone :
        active ? stepStyles.textActive :
        stepStyles.textMuted,
      ]}>
        {text}
      </Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  text: { fontSize: FontSize.md },
  textDone: { color: Colors.success },
  textActive: { color: Colors.warning, fontWeight: '600' },
  textMuted: { color: Colors.textMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'flex-end' },
  content: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  statusBadge: {
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
  title: {
    fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },
  rejectionCard: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.error + '15',
    borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.error + '44',
    width: '100%',
  },
  rejectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.error, marginBottom: 4 },
  rejectionText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  stepsCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  refreshBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
    width: '100%',
  },
  btnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  supportBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  supportBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  lgpdSection: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  lgpdText: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  deleteBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingVertical: 4,
  },
  deleteBtnText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
});
