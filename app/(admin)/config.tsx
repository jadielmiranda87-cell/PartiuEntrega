import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { getAppConfig, updateAppConfig } from '@/services/configService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from '@/template';
import { useFocusEffect } from 'expo-router';

interface UserRow {
  id: string;
  email: string;
  user_type: string;
}

export default function AdminConfigScreen() {
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [pricePerKm, setPricePerKm] = useState('');
  const [minDeliveryPrice, setMinDeliveryPrice] = useState('');
  const [cashbackPerBusiness, setCashbackPerBusiness] = useState('');
  const [cashbackPerMotoboy, setCashbackPerMotoboy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getAppConfig().then((c) => {
      setSubscriptionPrice(c.subscription_price);
      setPricePerKm(c.price_per_km);
      setMinDeliveryPrice(c.min_delivery_price);
      setCashbackPerBusiness(c.cashback_per_business_referral);
      setCashbackPerMotoboy(c.cashback_per_motoboy_referral);
      setLoading(false);
    });
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, user_type')
      .order('email');
    setUsers(data ?? []);
    setLoadingUsers(false);
  }, []);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const handleSave = async () => {
    const sp = parseFloat(subscriptionPrice);
    const pkm = parseFloat(pricePerKm);
    const mp = parseFloat(minDeliveryPrice);
    const cpb = parseFloat(cashbackPerBusiness);
    const cpm = parseFloat(cashbackPerMotoboy);

    if (isNaN(sp) || isNaN(pkm) || isNaN(mp) || sp <= 0 || pkm <= 0 || mp <= 0) {
      showAlert('Valores inválidos', 'Informe valores numéricos positivos.');
      return;
    }
    if (isNaN(cpb) || isNaN(cpm) || cpb < 0 || cpm < 0) {
      showAlert('Valores inválidos', 'Informe valores de cashback válidos (0 ou maior).');
      return;
    }

    setSaving(true);
    const [r1, r2, r3, r4, r5] = await Promise.all([
      updateAppConfig('subscription_price', sp.toFixed(2)),
      updateAppConfig('price_per_km', pkm.toFixed(2)),
      updateAppConfig('min_delivery_price', mp.toFixed(2)),
      updateAppConfig('cashback_per_business_referral', cpb.toFixed(2)),
      updateAppConfig('cashback_per_motoboy_referral', cpm.toFixed(2)),
    ]);
    setSaving(false);

    if (r1.error || r2.error || r3.error || r4.error || r5.error) {
      showAlert('Erro ao salvar', r1.error ?? r2.error ?? r3.error ?? r4.error ?? r5.error ?? 'Tente novamente.');
      return;
    }

    showAlert('Salvo!', 'Os novos valores já estão em vigor.');
  };

  const handleToggleAdmin = (user: UserRow) => {
    const isAdmin = user.user_type === 'admin';
    const action = isAdmin ? 'Remover acesso ADM' : 'Promover a ADM';
    const msg = isAdmin
      ? `Remover privilégios de administrador de ${user.email}?`
      : `Dar acesso de administrador para ${user.email}?`;

    showAlert(action, msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: isAdmin ? 'Remover' : 'Promover',
        style: isAdmin ? 'destructive' : 'default',
        onPress: async () => {
          setPromotingId(user.id);
          const newType = isAdmin ? 'business' : 'admin';
          const supabase = getSupabaseClient();
          const { error } = await supabase
            .from('user_profiles')
            .update({ user_type: newType })
            .eq('id', user.id);
          setPromotingId(null);
          if (error) {
            showAlert('Erro', error.message);
            return;
          }
          loadUsers();
        },
      },
    ]);
  };

  const TYPE_COLOR: Record<string, string> = {
    admin: Colors.primary,
    business: Colors.info,
    motoboy: Colors.secondary,
  };
  const TYPE_LABEL: Record<string, string> = {
    admin: 'ADM',
    business: 'Comércio',
    motoboy: 'Motoboy',
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Configurações</Text>
        <Text style={styles.pageSubtitle}>Valores e gestão de usuários</Text>

        {/* Preços */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="credit-card" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Assinatura dos Motoboys</Text>
          </View>
          <ConfigInput label="Valor mensal (R$)" value={subscriptionPrice} onChangeText={setSubscriptionPrice} />
          <View style={styles.infoRow}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>Cada pagamento dá 30 dias de acesso</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="two-wheeler" size={20} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Valor das Corridas</Text>
          </View>
          <ConfigInput label="Preço por km (R$)" value={pricePerKm} onChangeText={setPricePerKm} />
          <ConfigInput label="Valor mínimo de entrega (R$)" value={minDeliveryPrice} onChangeText={setMinDeliveryPrice} />
          <View style={styles.formulaCard}>
            <Text style={styles.formulaTitle}>Fórmula de cálculo</Text>
            <Text style={styles.formulaText}>Valor = MAX(mínimo, km × preço_km)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="card-giftcard" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Cashback por Indicação</Text>
          </View>
          <ConfigInput label="Cashback por comércio indicado (R$)" value={cashbackPerBusiness} onChangeText={setCashbackPerBusiness} />
          <ConfigInput label="Cashback por motoboy indicado (R$)" value={cashbackPerMotoboy} onChangeText={setCashbackPerMotoboy} />
          <View style={styles.infoRow}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>Creditado ao motoboy quando o indicado se cadastra e é aprovado</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <MaterialIcons name="save" size={20} color={Colors.white} />
              <Text style={styles.saveBtnText}>Salvar Configurações</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Gestão de usuários / ADM */}
        <View style={[styles.section, { marginTop: Spacing.md }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="admin-panel-settings" size={20} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Gerenciar Usuários</Text>
            <TouchableOpacity onPress={loadUsers} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="refresh" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionDesc}>
            Promova um usuário a ADM ou remova seus privilégios. ADMs têm acesso total ao painel.
          </Text>

          {loadingUsers ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : (
            users.map((user) => {
              const color = TYPE_COLOR[user.user_type] ?? Colors.textMuted;
              const label = TYPE_LABEL[user.user_type] ?? user.user_type;
              const isAdmin = user.user_type === 'admin';

              return (
                <View key={user.id} style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                    <View style={[styles.userBadge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.userBadgeText, { color }]}>{label}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.promoteBtn, isAdmin ? styles.demoteBtn : styles.elevateBtn, promotingId === user.id && styles.btnDisabled]}
                    onPress={() => handleToggleAdmin(user)}
                    disabled={promotingId === user.id}
                    activeOpacity={0.8}
                  >
                    {promotingId === user.id ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <MaterialIcons
                        name={isAdmin ? 'person-remove' : 'admin-panel-settings'}
                        size={16}
                        color={Colors.white}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Instrução SQL manual */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="code" size={20} color={Colors.textMuted} />
            <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>Promoção via SQL (alternativa)</Text>
          </View>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>
              {`UPDATE user_profiles\nSET user_type = 'admin'\nWHERE email = 'seu@email.com';`}
            </Text>
          </View>
          <Text style={styles.infoText} style={{ marginTop: 6 }}>
            Execute no OnSpace Cloud → Data → SQL Editor
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConfigInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Text style={styles.inputPrefix}>R$</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor={Colors.textMuted}
          placeholder="0.00"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text },
  pageSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, flex: 1 },
  sectionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 52, borderWidth: 1, borderColor: Colors.border,
  },
  inputPrefix: { fontSize: FontSize.md, color: Colors.textSecondary, marginRight: 4, fontWeight: '600' },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.xl, fontWeight: '600' },
  infoRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  infoText: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1, lineHeight: 20 },
  formulaCard: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, padding: Spacing.md },
  formulaTitle: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600', marginBottom: 4 },
  formulaText: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  codeBlock: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm },
  codeText: { fontSize: FontSize.sm, color: Colors.success, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  saveBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginRight: Spacing.sm },
  userEmail: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  userBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  userBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  promoteBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  elevateBtn: { backgroundColor: Colors.primary },
  demoteBtn: { backgroundColor: Colors.error },
});
