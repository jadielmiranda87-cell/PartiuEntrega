import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, ScrollView, Switch
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { getAppConfig } from '@/services/configService';
import { createSubscription } from '@/services/motoboyService';
import { addCashbackTransaction, getCashbackBalance } from '@/services/cashbackService';
import { getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';
import { useRouter } from 'expo-router';
import { FunctionsHttpError } from '@supabase/supabase-js';

export default function RenewSubscriptionScreen() {
  const [price, setPrice] = useState('99.90');
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [useCashback, setUseCashback] = useState(false);

  const { motoboyProfile, profile, refreshProfile, signOut } = useAppAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const c = await getAppConfig();
      setPrice(c.subscription_price);
      if (motoboyProfile) {
        const bal = await getCashbackBalance(motoboyProfile.id);
        setCashbackBalance(bal);
      }
      setLoadingConfig(false);
    };
    load();
  }, [motoboyProfile]);

  const subscriptionPrice = parseFloat(price);
  const cashbackToUse = useCashback ? Math.min(cashbackBalance, subscriptionPrice) : 0;
  const finalPrice = Math.max(0, subscriptionPrice - cashbackToUse);

  const expiryDate = motoboyProfile?.subscription_expires_at
    ? new Date(motoboyProfile.subscription_expires_at)
    : null;

  const handleRenew = async () => {
    if (!motoboyProfile || !profile) return;
    setLoading(true);

    const { data: sub, error: subError } = await createSubscription(
      motoboyProfile.id,
      finalPrice,
      false // renewal — never first subscription
    );

    if (subError || !sub) {
      setLoading(false);
      showAlert('Erro', subError ?? 'Falha ao criar assinatura.');
      return;
    }

    // Deduct cashback if used
    if (useCashback && cashbackToUse > 0) {
      await addCashbackTransaction(
        motoboyProfile.id,
        'used',
        cashbackToUse,
        `Cashback aplicado na renovação de assinatura`,
        sub.id
      );
    }

    if (finalPrice === 0) {
      // 100% covered by cashback — activate directly
      setLoading(false);
      showAlert('Assinatura renovada!', 'Seu cashback cobriu o valor total. Conta reativada!', [
        { text: 'OK', onPress: async () => { await refreshProfile(); router.replace('/'); } }
      ]);
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('mp-payment', {
      body: {
        motoboy_id: motoboyProfile.id,
        subscription_id: sub.id,
        amount: finalPrice,
        payer_email: profile.email,
        payer_name: motoboyProfile.name,
      },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = (await error.context?.text()) ?? msg; } catch { /* ignore */ }
      }
      setLoading(false);
      showAlert('Erro no pagamento', msg);
      return;
    }

    setLoading(false);

    if (data?.checkout_url) {
      await Linking.openURL(data.checkout_url);
      showAlert(
        'Pagamento iniciado',
        'Complete o pagamento no Mercado Pago. Após a confirmação, volte ao app e toque em "Verificar status".',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    await refreshProfile();
    setLoading(false);
    router.replace('/');
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="logout" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={styles.expiredBadge}>
          <MaterialIcons name="event-busy" size={18} color={Colors.error} />
          <Text style={styles.expiredBadgeText}>ASSINATURA VENCIDA</Text>
        </View>

        <View style={styles.iconContainer}>
          <MaterialIcons name="autorenew" size={64} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Renove sua Assinatura</Text>

        {expiryDate ? (
          <Text style={styles.subtitle}>
            Sua assinatura venceu em{' '}
            <Text style={styles.subtitleHighlight}>
              {expiryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
            {'. Renove para voltar a receber corridas.'}
          </Text>
        ) : (
          <Text style={styles.subtitle}>
            Sua assinatura está inativa. Renove para voltar a receber corridas.
          </Text>
        )}

        {loadingConfig ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Valor da renovação</Text>
            <Text style={[styles.priceValue, cashbackToUse > 0 && styles.priceValueStrike]}>
              {formatCurrency(subscriptionPrice)}
            </Text>

            {/* Cashback toggle */}
            {cashbackBalance > 0 && (
              <View style={styles.cashbackRow}>
                <View style={styles.cashbackLeft}>
                  <MaterialIcons name="card-giftcard" size={18} color={Colors.primary} />
                  <View>
                    <Text style={styles.cashbackLabel}>Usar cashback</Text>
                    <Text style={styles.cashbackAvailable}>Disponível: {formatCurrency(cashbackBalance)}</Text>
                  </View>
                </View>
                <Switch
                  value={useCashback}
                  onValueChange={setUseCashback}
                  trackColor={{ false: Colors.border, true: Colors.primary + '88' }}
                  thumbColor={useCashback ? Colors.primary : Colors.textMuted}
                />
              </View>
            )}

            {useCashback && cashbackToUse > 0 && (
              <View style={styles.discountRow}>
                <MaterialIcons name="remove-circle" size={16} color={Colors.success} />
                <Text style={styles.discountText}>Cashback aplicado: -{formatCurrency(cashbackToUse)}</Text>
              </View>
            )}

            {useCashback && cashbackToUse > 0 && (
              <View style={styles.finalPriceRow}>
                <Text style={styles.finalPriceLabel}>Valor a pagar</Text>
                <Text style={styles.finalPriceValue}>{finalPrice === 0 ? 'Grátis!' : formatCurrency(finalPrice)}</Text>
              </View>
            )}

            <Text style={styles.pricePeriod}>30 dias de acesso</Text>

            <View style={styles.divider} />

            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Ativação automática após pagamento</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Sem necessidade de aprovação ADM</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Acesso a todas as corridas disponíveis</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.payBtn, loading && styles.btnDisabled]}
          onPress={handleRenew}
          disabled={loading || loadingConfig}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <MaterialIcons name="payment" size={22} color={Colors.white} />
              <Text style={styles.payBtnText}>
                {finalPrice === 0 ? 'Renovar com Cashback' : 'Renovar com Mercado Pago'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkBtn} onPress={handleCheckStatus} disabled={loading} activeOpacity={0.8}>
          <MaterialIcons name="refresh" size={18} color={Colors.primary} />
          <Text style={styles.checkBtnText}>Verificar status do pagamento</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            O pagamento é processado pelo Mercado Pago. Após a confirmação, sua conta é reativada automaticamente em instantes.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'flex-end' },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  expiredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.error + '22', borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.error,
    marginBottom: Spacing.lg,
  },
  expiredBadgeText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1 },
  iconContainer: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2, borderColor: Colors.primary + '44',
  },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  subtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 24, marginBottom: Spacing.lg, paddingHorizontal: Spacing.sm,
  },
  subtitleHighlight: { color: Colors.error, fontWeight: '600' },
  priceCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary + '33',
    gap: 8,
  },
  priceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  priceValue: { fontSize: 40, fontWeight: '800', color: Colors.primary },
  priceValueStrike: { textDecorationLine: 'line-through', color: Colors.textMuted, fontSize: 28 },
  // Cashback
  cashbackRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary + '11', borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '33',
  },
  cashbackLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cashbackLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  cashbackAvailable: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  discountRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success + '11', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  discountText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '600' },
  finalPriceRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  finalPriceLabel: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
  finalPriceValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  pricePeriod: { fontSize: FontSize.sm, color: Colors.textMuted },
  divider: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
  benefitText: { color: Colors.text, fontSize: FontSize.md },
  payBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
    width: '100%', marginBottom: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  payBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  checkBtn: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', padding: Spacing.md },
  checkBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  infoBox: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingHorizontal: Spacing.sm, marginTop: Spacing.sm },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
});
