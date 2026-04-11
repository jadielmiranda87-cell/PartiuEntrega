import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getDeliveryById } from '@/services/deliveryService';
import { invokeDeliveryPayment } from '@/services/orderPaymentService';
import { listCustomerMpCards } from '@/services/customerMpCardsService';
import type { CustomerMpCard, Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';
import { useAlert } from '@/template';

function cardBrandLabel(methodId: string | null | undefined): string {
  if (!methodId) return 'Cartão';
  const m = methodId.toLowerCase();
  if (m.includes('visa')) return 'Visa';
  if (m.includes('master')) return 'Mastercard';
  if (m.includes('elo')) return 'Elo';
  if (m.includes('amex')) return 'Amex';
  return methodId.toUpperCase();
}

export default function OrderPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { userId } = useAppAuth();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [cards, setCards] = useState<CustomerMpCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pixQrUri, setPixQrUri] = useState<string | null>(null);
  const [pixCopia, setPixCopia] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [d, c] = await Promise.all([getDeliveryById(id), listCustomerMpCards()]);
    setDelivery(d);
    setCards(c);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCheckoutPro = async () => {
    if (!id) return;
    setBusy(true);
    const { data, error } = await invokeDeliveryPayment({ action: 'preference', delivery_id: id });
    setBusy(false);
    if (error) {
      showAlert('Pagamento', error);
      return;
    }
    const url = (data?.checkout_url as string) || '';
    if (url) {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else showAlert('Pagamento', 'Não foi possível abrir o link do Mercado Pago.');
    }
  };

  const startPix = async () => {
    if (!id) return;
    setBusy(true);
    setPixQrUri(null);
    setPixCopia(null);
    const { data, error } = await invokeDeliveryPayment({ action: 'pix', delivery_id: id });
    setBusy(false);
    if (error) {
      showAlert('Pix', error);
      return;
    }
    const b64 = data?.qr_code_base64 as string | undefined;
    const copy = data?.qr_code as string | undefined;
    if (b64) {
      const uri = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
      setPixQrUri(uri);
    }
    if (copy) setPixCopia(copy);
    if (!b64 && !copy) {
      showAlert('Pix', 'Resposta sem QR. Tente o pagamento pelo Mercado Pago.');
    }
  };

  const paySaved = async (cardId: string) => {
    if (!id) return;
    setBusy(true);
    const { data, error } = await invokeDeliveryPayment({
      action: 'saved_card',
      delivery_id: id,
      saved_card_id: cardId,
    });
    setBusy(false);
    if (error) {
      showAlert('Cartão', error);
      return;
    }
    const paid = data?.paid === true || data?.status === 'approved';
    if (paid) {
      await load();
      showAlert('Pago!', 'Pagamento confirmado.', [{ text: 'OK', onPress: () => router.replace('/(customer)/orders') }]);
    } else {
      showAlert(
        'Pagamento',
        `Status: ${String(data?.status ?? 'pendente')}. Aguarde a confirmação ou use outro meio.`
      );
      load();
    }
  };

  const copyPix = async () => {
    if (!pixCopia) return;
    await Clipboard.setStringAsync(pixCopia);
    showAlert('Copiado', 'Código Pix copiado para a área de transferência.');
  };

  if (!id || !userId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.textSecondary }}>Pedido inválido</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!delivery || delivery.customer_user_id !== userId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.textSecondary }}>Pedido não encontrado</Text>
      </View>
    );
  }

  const payStatus = delivery.payment_status ?? 'n/a';
  const total = Number(delivery.price);
  const isPaid = payStatus === 'paid';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <Text style={styles.title}>Pagamento do pedido</Text>
      <Text style={styles.total}>{formatCurrency(total)}</Text>

      {isPaid ? (
        <View style={styles.okBox}>
          <MaterialIcons name="check-circle" size={40} color={Colors.success} />
          <Text style={styles.okText}>Pagamento confirmado</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(customer)/orders')}>
            <Text style={styles.primaryBtnText}>Ver meus pedidos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.hint}>
            Escolha Pix, cartão salvo (se já tiver usado antes) ou abra o Mercado Pago para crédito, débito ou Pix no
            checkout — após a primeira compra com cartão por lá, o cartão pode aparecer aqui para as próximas.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.disabled]}
            onPress={openCheckoutPro}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <MaterialIcons name="open-in-new" size={22} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Mercado Pago (Pix, crédito ou débito)</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.section}>Pix no app</Text>
          <TouchableOpacity style={[styles.secondaryBtn, busy && styles.disabled]} onPress={startPix} disabled={busy}>
            <MaterialIcons name="qr-code-2" size={22} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>{pixQrUri || pixCopia ? 'Gerar novo Pix' : 'Gerar QR Pix'}</Text>
          </TouchableOpacity>

          {pixQrUri ? (
            <View style={styles.pixBox}>
              <Image source={{ uri: pixQrUri }} style={styles.pixImg} resizeMode="contain" />
            </View>
          ) : null}
          {pixCopia ? (
            <TouchableOpacity style={styles.copyBtn} onPress={copyPix}>
              <MaterialIcons name="content-copy" size={20} color={Colors.primary} />
              <Text style={styles.copyBtnText}>Copiar código Pix</Text>
            </TouchableOpacity>
          ) : null}

          {cards.length > 0 ? (
            <>
              <Text style={styles.section}>Cartões salvos</Text>
              {cards.map((c) => (
                <View key={c.id} style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {cardBrandLabel(c.payment_method_id)} ·••• {c.last_four_digits ?? '****'}
                    </Text>
                    {c.cardholder_name ? <Text style={styles.cardSub}>{c.cardholder_name}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.paySmall, busy && styles.disabled]}
                    onPress={() => paySaved(c.id)}
                    disabled={busy}
                  >
                    <Text style={styles.paySmallText}>Pagar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.footNote}>
            O primeiro cadastro de cartão costuma ser feito no checkout do Mercado Pago. Depois do pagamento aprovado, o
            cartão pode ser guardado aqui para uso rápido.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  total: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, marginTop: 8, marginBottom: Spacing.md },
  hint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  section: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, minHeight: 52, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md, textAlign: 'center', flexShrink: 1 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary, minHeight: 48, borderRadius: BorderRadius.md,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  pixBox: { alignItems: 'center', marginTop: Spacing.md },
  pixImg: { width: 220, height: 220, backgroundColor: Colors.surface },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.sm,
  },
  copyBtnText: { color: Colors.primary, fontWeight: '700' },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  paySmall: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md },
  paySmallText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.sm },
  footNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.lg, lineHeight: 18 },
  okBox: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
  okText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
});
