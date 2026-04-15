import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp } from '@/utils/links';
import { useRouter } from 'expo-router';
import { APP_SHORT_NAME } from '@/constants/branding';
import { getBillingConfig } from '@/services/billingConfig';
import { updateBusinessProfile, syncBusinessCoordinates } from '@/services/businessService';
import type { BillingConfig, BusinessBillingPlan } from '@/types';
import { useAlert } from '@/template';

export default function BusinessProfileScreen() {
  const { businessProfile, profile, signOut, loading: authLoading, refreshProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [billingInfo, setBillingInfo] = useState<BillingConfig | null>(null);
  const [plan, setPlan] = useState<BusinessBillingPlan>('basic');
  const [apiKey, setApiKey] = useState('');
  const [commerceName, setCommerceName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBilling = useCallback(() => {
    getBillingConfig().then(setBillingInfo).catch(() => setBillingInfo(null));
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    if (!businessProfile) return;
    setCommerceName(businessProfile.name ?? '');
    setPlan(businessProfile.billing_plan === 'delivery' ? 'delivery' : 'basic');
    setApiKey(businessProfile.payment_api_key ?? '');
  }, [businessProfile]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleSaveCommerce = async () => {
    if (!businessProfile) return;
    const nameTrim = commerceName.trim();
    if (nameTrim.length < 2) {
      showAlert('Nome do comércio', 'Informe um nome com pelo menos 2 caracteres. Esse nome aparece para os clientes e na busca.');
      return;
    }
    setSaving(true);
    const { error } = await updateBusinessProfile(businessProfile.id, {
      name: nameTrim,
      billing_plan: plan,
      payment_api_key: apiKey.trim() || null,
    });
    setSaving(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    await refreshProfile();
    void syncBusinessCoordinates(businessProfile.id);
    showAlert('Salvo', 'Nome, plano e chave API atualizados.');
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg }}>
        <MaterialIcons name="store" size={48} color={Colors.textMuted} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: FontSize.md, textAlign: 'center' }}>Perfil do comércio não encontrado</Text>
        <Text style={{ color: Colors.textMuted, marginTop: 6, fontSize: FontSize.sm, textAlign: 'center' }}>Tente recarregar ou sair e entrar novamente.</Text>
        <TouchableOpacity
          onPress={() => refreshProfile()}
          style={{ marginTop: 20, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: Colors.white, fontWeight: '600' }}>Recarregar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.error, fontSize: FontSize.sm }}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const planBasic = billingInfo?.plan_basic;
  const planDel = billingInfo?.plan_delivery;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Perfil</Text>

        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <MaterialIcons name="store" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.nameFieldLabel}>Nome do comércio (vitrine e busca)</Text>
          <TextInput
            style={styles.bizNameInput}
            value={commerceName}
            onChangeText={setCommerceName}
            placeholder="Ex.: Pizzaria do João"
            placeholderTextColor={Colors.textMuted}
            maxLength={120}
            autoCorrect
          />
          <Text style={styles.nameFieldHint}>
            Os clientes encontram sua loja ao digitar esse nome na busca e veem só o seu cardápio.
          </Text>
          <Text style={styles.bizEmail}>{profile?.email}</Text>
        </View>

        <View style={styles.section}>
          <InfoRow label="Telefone" value={businessProfile.phone} />
          {businessProfile.cnpj ? <InfoRow label="CNPJ" value={businessProfile.cnpj} /> : null}
          <InfoRow label="Endereço" value={`${businessProfile.address}, ${businessProfile.address_number}`} />
          {businessProfile.complement ? <InfoRow label="Complemento" value={businessProfile.complement} /> : null}
          <InfoRow label="Bairro" value={businessProfile.neighborhood} />
          <InfoRow label="Cidade" value={`${businessProfile.city} - ${businessProfile.state}`} />
          <InfoRow label="CEP" value={businessProfile.cep} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="account-balance-wallet" size={20} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Plano e repasses</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Os pagamentos dos pedidos são processados na conta da plataforma; após as taxas, o valor é repassado ao seu negócio. Informe a chave API do seu gateway (ex.: Mercado Pago) para habilitar repasses.
          </Text>

          <Text style={styles.label}>Plano contratado</Text>
          <View style={styles.planRow}>
            <TouchableOpacity
              style={[styles.planChip, plan === 'basic' && styles.planChipActive]}
              onPress={() => setPlan('basic')}
              activeOpacity={0.85}
            >
              <Text style={[styles.planChipText, plan === 'basic' && styles.planChipTextActive]}>Básico</Text>
              <Text style={styles.planChipSub} numberOfLines={2}>
                {planBasic?.label ?? 'Entrega própria'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.planChip, plan === 'delivery' && styles.planChipActive]}
              onPress={() => setPlan('delivery')}
              activeOpacity={0.85}
            >
              <Text style={[styles.planChipText, plan === 'delivery' && styles.planChipTextActive]}>Entrega</Text>
              <Text style={styles.planChipSub} numberOfLines={2}>
                {planDel?.label ?? 'Motoboys da plataforma'}
              </Text>
            </TouchableOpacity>
          </View>

          {planBasic && plan === 'basic' ? (
            <Text style={styles.planHint}>
              Comissão {planBasic.commission_percent}% + taxa online {planBasic.payment_fee_percent_min}–{planBasic.payment_fee_percent_max}%. Mensalidade R${' '}
              {planBasic.monthly_fee_min}–{planBasic.monthly_fee_max} se faturar acima de R$ {planBasic.monthly_revenue_threshold}.
            </Text>
          ) : null}
          {planDel && plan === 'delivery' ? (
            <Text style={styles.planHint}>
              Comissão {planDel.commission_percent}% + taxa online {planDel.payment_fee_percent_min}–{planDel.payment_fee_percent_max}%. Mensalidade R$ {planDel.monthly_fee_fixed} se faturar acima de R$ {planDel.monthly_revenue_threshold}.
            </Text>
          ) : null}

          <Text style={[styles.label, { marginTop: Spacing.md }]}>Chave API do gateway (estabelecimento)</Text>
          <TextInput
            style={styles.apiInput}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="Cole o access token ou chave fornecida pelo gateway"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.apiHint}>Armazenada de forma segura no servidor; use credenciais de produção apenas em ambiente controlado.</Text>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSaveCommerce}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Salvar nome, plano e chave</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.whatsappBtn}
          onPress={() => openWhatsApp(businessProfile.phone, `Olá, sou do ${APP_SHORT_NAME}!`)}
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
    </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  avatarCard: { alignItems: 'stretch', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, alignSelf: 'center' },
  nameFieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  bizNameInput: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceElevated,
  },
  nameFieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8, lineHeight: 18 },
  bizEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  sectionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8, fontWeight: '600' },
  planRow: { flexDirection: 'row', gap: Spacing.sm },
  planChip: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
  },
  planChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  planChipText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  planChipTextActive: { color: Colors.primary },
  planChipSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  planHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 18 },
  apiInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: FontSize.sm,
    minHeight: 48,
  },
  apiHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },
  saveBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.65 },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  whatsappBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  whatsappBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  logoutBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  logoutBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.md },
});
