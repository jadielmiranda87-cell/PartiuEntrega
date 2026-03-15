import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { getAppConfig } from '@/services/configService';
import { createSubscription } from '@/services/motoboyService';
import { getSupabaseClient } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';
import { useRouter } from 'expo-router';
import { FunctionsHttpError } from '@supabase/supabase-js';

export default function PaymentScreen() {
  const [price, setPrice] = useState('99.90');
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const { motoboyProfile, profile, refreshProfile, signOut } = useAppAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    getAppConfig().then((c) => {
      setPrice(c.subscription_price);
      setLoadingConfig(false);
    });
  }, []);

  const handlePay = async () => {
    if (!motoboyProfile || !profile) return;
    setLoading(true);

    const { data: sub, error: subError } = await createSubscription(
      motoboyProfile.id,
      parseFloat(price),
      motoboyProfile.is_first_subscription
    );

    if (subError || !sub) {
      setLoading(false);
      showAlert('Erro', subError ?? 'Falha ao criar assinatura.');
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('mp-payment', {
      body: {
        motoboy_id: motoboyProfile.id,
        subscription_id: sub.id,
        amount: parseFloat(price),
        payer_email: profile.email,
        payer_name: motoboyProfile.name,
      },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context?.text() ?? msg; } catch { /* ignore */ }
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
        'Complete o pagamento no navegador. Após a confirmação, volte ao app e toque em "Verificar status".',
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
        <TouchableOpacity onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="credit-card" size={64} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Assinatura Mensal</Text>
        <Text style={styles.subtitle}>
          Para ter acesso às corridas, você precisa assinar o plano mensal.
        </Text>

        {loadingConfig ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Valor da assinatura</Text>
            <Text style={styles.priceValue}>{formatCurrency(parseFloat(price))}</Text>
            <Text style={styles.pricePeriod}>por mês</Text>

            <View style={styles.divider} />

            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Acesso ilimitado às corridas</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Links de navegação Waze</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Contato direto com o comércio</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              <Text style={styles.benefitText}>Validade de 30 dias</Text>
            </View>
          </View>
        )}

        <View style={styles.noteCard}>
          <MaterialIcons name="info-outline" size={18} color={Colors.warning} />
          <Text style={styles.noteText}>
            Primeira assinatura: seus dados serão verificados pelo ADM após o pagamento.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, loading && styles.btnDisabled]}
          onPress={handlePay}
          disabled={loading || loadingConfig}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <MaterialIcons name="payment" size={22} color={Colors.white} />
              <Text style={styles.payBtnText}>Pagar com Mercado Pago</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkBtn}
          onPress={handleCheckStatus}
          disabled={loading}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={18} color={Colors.primary} />
          <Text style={styles.checkBtnText}>Verificar status do pagamento</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'flex-end' },
  content: { flex: 1, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  iconContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg },
  priceCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center',
  },
  priceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  priceValue: { fontSize: 40, fontWeight: '800', color: Colors.primary, marginVertical: 4 },
  pricePeriod: { fontSize: FontSize.sm, color: Colors.textMuted },
  divider: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start', marginBottom: 8 },
  benefitText: { color: Colors.text, fontSize: FontSize.md },
  noteCard: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#2a2000',
    borderRadius: BorderRadius.md, padding: Spacing.md, width: '100%',
    borderWidth: 1, borderColor: Colors.warning, marginBottom: Spacing.lg,
  },
  noteText: { flex: 1, color: Colors.warning, fontSize: FontSize.sm, lineHeight: 20 },
  payBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
    width: '100%', marginBottom: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  payBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  checkBtn: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    padding: Spacing.md,
  },
  checkBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
});
