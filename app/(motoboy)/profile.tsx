import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Share, ActivityIndicator, FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp, formatDate, formatCurrency } from '@/utils/links';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { getCashbackTransactions, CashbackTransaction, ensureReferralCode } from '@/services/cashbackService';

type Tab = 'profile' | 'cashback';

export default function MotoboyProfileScreen() {
  const { motoboyProfile, profile, signOut, refreshProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Garante que o código de cashback exista (para motoboys antigos sem referral_code)
  useFocusEffect(useCallback(() => {
    if (!motoboyProfile?.id) return;
    const code = motoboyProfile.referral_code;
    if (code) {
      setReferralCode(code);
      return;
    }
    ensureReferralCode(motoboyProfile.id).then((c) => {
      if (c) {
        setReferralCode(c);
        refreshProfile();
      }
    });
  }, [motoboyProfile?.id, motoboyProfile?.referral_code, refreshProfile]));

  const displayCode = referralCode ?? motoboyProfile?.referral_code ?? '--------';

  const loadTransactions = useCallback(async () => {
    if (!motoboyProfile) return;
    setLoadingTx(true);
    const data = await getCashbackTransactions(motoboyProfile.id);
    setTransactions(data);
    setLoadingTx(false);
  }, [motoboyProfile]);

  useFocusEffect(useCallback(() => {
    if (activeTab === 'cashback') loadTransactions();
  }, [activeTab, loadTransactions]));

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleShare = async () => {
    if (!displayCode || displayCode === '--------') return;
    await Share.share({
      message: `Use meu código de indicação no PartiuEntrega e me ajude a ganhar cashback: ${displayCode}`,
    });
  };

  if (!motoboyProfile) return null;

  const isActive = motoboyProfile.status === 'active';
  const expiry = motoboyProfile.subscription_expires_at;
  const isExpired = expiry ? new Date(expiry) < new Date() : true;
  const cashbackBalance = motoboyProfile.cashback_balance ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.pageTitle}>Meu Perfil</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
            onPress={() => setActiveTab('profile')}
          >
            <MaterialIcons name="person" size={18} color={activeTab === 'profile' ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Dados</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'cashback' && styles.tabActive]}
            onPress={() => { setActiveTab('cashback'); loadTransactions(); }}
          >
            <MaterialIcons name="card-giftcard" size={18} color={activeTab === 'cashback' ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'cashback' && styles.tabLabelActive]}>Cashback</Text>
            {cashbackBalance > 0 && (
              <View style={styles.balanceBadge}>
                <Text style={styles.balanceBadgeText}>{formatCurrency(cashbackBalance)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'profile' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24, paddingTop: Spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar card */}
          <View style={styles.avatarCard}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={40} color={Colors.secondary} />
            </View>
            <Text style={styles.motoboyName}>{motoboyProfile.name}</Text>
            <Text style={styles.motoboyEmail}>{profile?.email}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isActive && !isExpired ? Colors.success + '22' : Colors.warning + '22' }]}>
              <Text style={[styles.statusText, { color: isActive && !isExpired ? Colors.success : Colors.warning }]}>
                {isActive && !isExpired ? 'Ativo' : isExpired ? 'Assinatura expirada' : 'Pendente'}
              </Text>
            </View>
            {expiry && (
              <Text style={styles.expiryText}>Válido até {formatDate(expiry)}</Text>
            )}
          </View>

          {/* Referral Code Card */}
          <View style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <MaterialIcons name="card-giftcard" size={20} color={Colors.primary} />
              <Text style={styles.referralTitle}>Seu código de indicação</Text>
            </View>
            <Text style={styles.referralSubtitle}>
              Compartilhe com comércios ou motoboys. Ganhe cashback quando eles se cadastrarem!
            </Text>
            <View style={styles.referralCodeRow}>
              <Text style={styles.referralCode}>{displayCode}</Text>
              <TouchableOpacity
                style={[styles.shareBtn, (!displayCode || displayCode === '--------') && styles.shareBtnDisabled]}
                onPress={handleShare}
                activeOpacity={0.8}
                disabled={!displayCode || displayCode === '--------'}
              >
                <MaterialIcons name="share" size={18} color={Colors.white} />
                <Text style={styles.shareBtnText}>Compartilhar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados Pessoais</Text>
            <InfoRow label="CPF" value={motoboyProfile.cpf} />
            <InfoRow label="Telefone" value={motoboyProfile.phone} />
            <InfoRow label="Cidade" value={`${motoboyProfile.city} - ${motoboyProfile.state}`} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CNH</Text>
            <InfoRow label="Número" value={motoboyProfile.cnh_number} />
            <InfoRow label="Categoria" value={motoboyProfile.cnh_category} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moto</Text>
            <InfoRow label="Marca" value={motoboyProfile.moto_brand} />
            <InfoRow label="Modelo" value={motoboyProfile.moto_model} />
            <InfoRow label="Placa" value={motoboyProfile.moto_plate} />
            <InfoRow label="Ano" value={motoboyProfile.moto_year} />
          </View>

          <TouchableOpacity
            style={styles.whatsappBtn}
            onPress={() => openWhatsApp(motoboyProfile.phone)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="chat" size={20} color={Colors.white} />
            <Text style={styles.whatsappBtnText}>Abrir WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <MaterialIcons name="logout" size={20} color={Colors.error} />
            <Text style={styles.logoutBtnText}>Sair da conta</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── Cashback Tab ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24, paddingTop: Spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <MaterialIcons name="account-balance-wallet" size={32} color={Colors.primary} />
            <Text style={styles.balanceLabel}>Saldo de cashback disponível</Text>
            <Text style={styles.balanceValue}>{formatCurrency(cashbackBalance)}</Text>
            <Text style={styles.balanceHint}>Usado automaticamente na próxima renovação de assinatura</Text>
          </View>

          {/* How it works */}
          <View style={styles.howItWorksCard}>
            <Text style={styles.howTitle}>Como ganhar cashback?</Text>
            <View style={styles.howRow}>
              <View style={styles.howIcon}>
                <MaterialIcons name="store" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.howText}>Indique um comércio — ele usa seu código no cadastro e você ganha cashback.</Text>
            </View>
            <View style={styles.howRow}>
              <View style={styles.howIcon}>
                <MaterialIcons name="two-wheeler" size={18} color={Colors.secondary} />
              </View>
              <Text style={styles.howText}>Indique outro motoboy — ele usa seu código e você ganha cashback ao ser aprovado.</Text>
            </View>
            <TouchableOpacity style={styles.shareBtn2} onPress={handleShare} activeOpacity={0.8}>
              <MaterialIcons name="share" size={16} color={Colors.white} />
              <Text style={styles.shareBtnText}>Compartilhar código: {displayCode}</Text>
            </TouchableOpacity>
          </View>

          {/* Transaction history */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Histórico de Cashback</Text>
            {loadingTx ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
            ) : transactions.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="card-giftcard" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhuma movimentação ainda</Text>
                <Text style={styles.emptySubText}>Comece a indicar e acumule cashback!</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: tx.type === 'earned' ? Colors.success + '22' : Colors.error + '22' }]}>
                    <MaterialIcons
                      name={tx.type === 'earned' ? 'add' : 'remove'}
                      size={18}
                      color={tx.type === 'earned' ? Colors.success : Colors.error}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDescription}>{tx.description}</Text>
                    <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === 'earned' ? Colors.success : Colors.error }]}>
                    {tx.type === 'earned' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  value: { fontSize: FontSize.sm, color: Colors.text, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingBottom: 0,
  },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  tabs: { flexDirection: 'row', gap: Spacing.sm },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary },
  balanceBadge: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  balanceBadgeText: { fontSize: 10, color: Colors.white, fontWeight: '800' },
  // Avatar
  avatarCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  motoboyName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  motoboyEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: Spacing.sm },
  statusText: { fontWeight: '700', fontSize: FontSize.sm },
  expiryText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  // Referral
  referralCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  referralTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  referralSubtitle: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18, marginBottom: Spacing.md },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  referralCode: {
    flex: 1, fontSize: FontSize.xl, fontWeight: '800', color: Colors.text,
    letterSpacing: 4, backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md, padding: Spacing.sm, textAlign: 'center',
  },
  shareBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareBtn2: {
    flexDirection: 'row', gap: 6, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md,
  },
  shareBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  // Section
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.secondary, marginBottom: Spacing.sm },
  // Cashback balance
  balanceCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary + '44', gap: 6,
  },
  balanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  balanceValue: { fontSize: 40, fontWeight: '800', color: Colors.primary },
  balanceHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  // How it works
  howItWorksCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  howRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: Spacing.sm },
  howIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  howText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  // Transactions
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  txIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  txDescription: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  txDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: FontSize.md, fontWeight: '800' },
  // Action buttons
  whatsappBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  whatsappBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  logoutBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  logoutBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.md },
});
