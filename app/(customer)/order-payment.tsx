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
  Modal,
  Pressable,
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

/** Limite informativo (ex.: política do gateway) — mesmo espírito do app de referência. */
const APP_PAY_LIMIT_BRL = 600;

function cardBrandLabel(methodId: string | null | undefined): string {
  if (!methodId) return 'Cartão';
  const m = methodId.toLowerCase();
  if (m.includes('visa')) return 'Visa';
  if (m.includes('master')) return 'Mastercard';
  if (m.includes('elo')) return 'Elo';
  if (m.includes('amex')) return 'Amex';
  return methodId.toUpperCase();
}

type PayTab = 'app' | 'delivery';
type AppSelection = 'pix' | { type: 'saved'; cardId: string } | null;

function BrandMiniLogos() {
  const brands = [
    { t: 'Visa', bg: '#1A1F71' },
    { t: 'Master', bg: '#EB001B' },
    { t: 'Elo', bg: '#FFCB05' },
    { t: 'Amex', bg: '#006FCF' },
  ];
  return (
    <View style={brandStyles.row}>
      {brands.map((b) => (
        <View key={b.t} style={[brandStyles.pill, { backgroundColor: b.bg }]}>
          <Text style={brandStyles.pillText}>{b.t}</Text>
        </View>
      ))}
    </View>
  );
}

const brandStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  pill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  pillText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
});

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[radioStyles.outer, selected && radioStyles.outerOn]}>
      {selected ? <View style={radioStyles.inner} /> : null}
    </View>
  );
}

const radioStyles = StyleSheet.create({
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerOn: { borderColor: Colors.text },
  inner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.text },
});

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

  const [tab, setTab] = useState<PayTab>('app');
  const [selection, setSelection] = useState<AppSelection>(null);
  const [addMethodOpen, setAddMethodOpen] = useState(false);

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
      showAlert('Pix', 'Resposta sem QR. Use a opção cartão no Mercado Pago.');
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
    showAlert('Copiado', 'Código Pix copiado. Cole no app do banco para pagar.');
  };

  const handleAddCardFromSheet = () => {
    setAddMethodOpen(false);
    setSelection(null);
    openCheckoutPro();
  };

  const handleAddPixFromSheet = async () => {
    setAddMethodOpen(false);
    setSelection('pix');
    setTab('app');
    await startPix();
  };

  const handleConfirm = async () => {
    if (tab === 'delivery') {
      showAlert(
        'Pagamento na entrega',
        'Combine com o restaurante ou pague em dinheiro ou Pix direto ao entregador quando receber o pedido.',
        [{ text: 'OK', onPress: () => router.replace('/(customer)/orders') }]
      );
      return;
    }

    if (total > APP_PAY_LIMIT_BRL) {
      showAlert(
        'Limite',
        `O valor ultrapassa o limite de ${formatCurrency(APP_PAY_LIMIT_BRL)} para pagamento no app. Use outro meio ou pague na entrega.`
      );
      return;
    }

    if (!selection) {
      showAlert('Pagamento', 'Selecione Pix ou um cartão salvo, ou adicione cartão / Pix.');
      return;
    }

    if (selection === 'pix') {
      if (!pixCopia && !pixQrUri) {
        await startPix();
        return;
      }
      const fresh = await getDeliveryById(id);
      if (fresh?.payment_status === 'paid') {
        showAlert('Pago!', 'Pagamento já confirmado.', [{ text: 'OK', onPress: () => router.replace('/(customer)/orders') }]);
        return;
      }
      showAlert(
        'Pix',
        'Após pagar no app do banco, a confirmação pode levar alguns instantes. Acompanhe em Meus pedidos.'
      );
      return;
    }

    await paySaved(selection.cardId);
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
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.sm,
          paddingBottom: 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.totalLabel}>Total do pedido</Text>
        <Text style={styles.total}>{formatCurrency(total)}</Text>

        {isPaid ? (
          <View style={styles.okBox}>
            <MaterialIcons name="check-circle" size={48} color={Colors.success} />
            <Text style={styles.okText}>Pagamento confirmado</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(customer)/orders')}>
              <Text style={styles.primaryBtnText}>Ver meus pedidos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              <Pressable style={styles.tabBtn} onPress={() => setTab('app')}>
                <Text style={[styles.tabText, tab === 'app' && styles.tabTextActive]}>Pagar pelo aplicativo</Text>
                {tab === 'app' ? <View style={styles.tabLine} /> : <View style={styles.tabLineHidden} />}
              </Pressable>
              <Pressable style={styles.tabBtn} onPress={() => setTab('delivery')}>
                <Text style={[styles.tabText, tab === 'delivery' && styles.tabTextActive]}>Pagar na entrega</Text>
                {tab === 'delivery' ? <View style={styles.tabLine} /> : <View style={styles.tabLineHidden} />}
              </Pressable>
            </View>

            {tab === 'app' ? (
              <>
                <Text style={styles.banner}>
                  O limite máximo para pagamento no aplicativo é {formatCurrency(APP_PAY_LIMIT_BRL)}.
                </Text>
                {total > APP_PAY_LIMIT_BRL ? (
                  <View style={styles.warnBox}>
                    <MaterialIcons name="warning" size={20} color={Colors.warning} />
                    <Text style={styles.warnText}>
                      Este pedido ultrapassa o limite. Escolha &quot;Pagar na entrega&quot; ou entre em contato com o
                      restaurante.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.sectionTitle}>Forma de pagamento</Text>

                <TouchableOpacity
                  style={[styles.methodCard, selection === 'pix' && styles.methodCardOn]}
                  onPress={() => setSelection('pix')}
                  activeOpacity={0.9}
                >
                  <View style={styles.pixIconWrap}>
                    <Text style={styles.pixGlyph}>Pix</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Pix</Text>
                    <Text style={styles.methodSub}>Copie o código ou use o QR no app do banco</Text>
                  </View>
                  <Radio selected={selection === 'pix'} />
                </TouchableOpacity>

                {selection === 'pix' ? (
                  <View style={styles.pixDetail}>
                    <TouchableOpacity
                      style={[styles.genPixBtn, busy && styles.disabled]}
                      onPress={startPix}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color={Colors.black} />
                      ) : (
                        <>
                          <MaterialIcons name="qr-code-2" size={22} color={Colors.black} />
                          <Text style={styles.genPixBtnText}>{pixCopia || pixQrUri ? 'Gerar novo código Pix' : 'Gerar código Pix'}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {pixQrUri ? (
                      <View style={styles.pixQrWrap}>
                        <Image source={{ uri: pixQrUri }} style={styles.pixImg} resizeMode="contain" />
                      </View>
                    ) : null}
                    {pixCopia ? (
                      <>
                        <Text style={styles.pixCopyHint}>Pix copia e cola</Text>
                        <View style={styles.pixCodeBox}>
                          <Text style={styles.pixCodeText} numberOfLines={3} selectable>
                            {pixCopia}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.copyBigBtn} onPress={copyPix} activeOpacity={0.9}>
                          <MaterialIcons name="content-copy" size={22} color={Colors.black} />
                          <Text style={styles.copyBigText}>Copiar código Pix</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {cards.length > 0 ? (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Cartões salvos</Text>
                    {cards.map((c) => {
                      const sel = selection?.type === 'saved' && selection.cardId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.methodCard, sel && styles.methodCardOn]}
                          onPress={() => setSelection({ type: 'saved', cardId: c.id })}
                          activeOpacity={0.9}
                        >
                          <MaterialIcons name="credit-card" size={28} color={Colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.methodTitle}>
                              {cardBrandLabel(c.payment_method_id)} ·••• {c.last_four_digits ?? '****'}
                            </Text>
                            {c.cardholder_name ? <Text style={styles.methodSub}>{c.cardholder_name}</Text> : null}
                          </View>
                          <Radio selected={sel} />
                        </TouchableOpacity>
                      );
                    })}
                  </>
                ) : null}

                <TouchableOpacity style={styles.addMethodRow} onPress={() => setAddMethodOpen(true)} activeOpacity={0.9}>
                  <MaterialIcons name="add-circle-outline" size={26} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addMethodTitle}>Adicionar método de pagamento</Text>
                    <BrandMiniLogos />
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
                </TouchableOpacity>

                <Text style={styles.footNote}>
                  Cartões são cadastrados com segurança pelo Mercado Pago. Na primeira compra com cartão, use a opção do
                  sheet ou o fluxo abaixo.
                </Text>
              </>
            ) : (
              <View style={styles.deliveryBox}>
                <MaterialIcons name="delivery-dining" size={40} color={Colors.secondary} />
                <Text style={styles.deliveryTitle}>Pague quando receber</Text>
                <Text style={styles.deliveryText}>
                  Você pode pagar em dinheiro ou Pix direto ao entregador ou conforme combinado com o restaurante. O
                  pedido segue normalmente após a confirmação do comércio.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!isPaid ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, (busy || (tab === 'app' && total > APP_PAY_LIMIT_BRL)) && styles.disabled]}
            onPress={handleConfirm}
            disabled={busy || (tab === 'app' && total > APP_PAY_LIMIT_BRL)}
          >
            {busy ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.confirmText}>{tab === 'delivery' ? 'Entendi' : 'Confirmar'}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={addMethodOpen} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAddMethodOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setAddMethodOpen(false)} hitSlop={12} style={styles.sheetClose}>
                <MaterialIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Adicionar método de pagamento</Text>
              <View style={{ width: 40 }} />
            </View>

            <TouchableOpacity style={styles.sheetRow} onPress={handleAddCardFromSheet} disabled={busy}>
              <View style={styles.sheetIconBlue}>
                <MaterialIcons name="credit-card" size={24} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Cartão de crédito / débito</Text>
                <Text style={styles.sheetRowSub}>Mercado Pago — cadastre ou pague com cartão</Text>
                <BrandMiniLogos />
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleAddPixFromSheet} disabled={busy}>
              <View style={styles.sheetIconPix}>
                <Text style={styles.sheetPixMark}>Pix</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Pagar com Pix</Text>
                <Text style={styles.sheetRowSub}>Gera QR e código copia e cola</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  total: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.md },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.md },
  tabBtn: { flex: 1, alignItems: 'center', paddingBottom: 10 },
  tabText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.text, fontWeight: '800' },
  tabLine: { height: 3, backgroundColor: Colors.text, borderRadius: 2, marginTop: 8, width: '60%' },
  tabLineHidden: { height: 3, marginTop: 8, opacity: 0 },
  banner: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  warnBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.warning + '18',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
  },
  warnText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodCardOn: { borderColor: Colors.primary + '88', backgroundColor: Colors.primary + '0C' },
  pixIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: '#32BCAD22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixGlyph: { color: '#32BCAD', fontWeight: '900', fontSize: FontSize.sm },
  methodTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  methodSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  pixDetail: { marginBottom: Spacing.md },
  genPixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondary,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  genPixBtnText: { color: Colors.black, fontWeight: '800', fontSize: FontSize.md },
  pixQrWrap: { alignItems: 'center', marginVertical: Spacing.sm },
  pixImg: { width: 200, height: 200, backgroundColor: Colors.surface },
  pixCopyHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  pixCodeBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  pixCodeText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  copyBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondary,
    minHeight: 52,
    borderRadius: BorderRadius.lg,
  },
  copyBigText: { color: Colors.black, fontWeight: '900', fontSize: FontSize.md },
  addMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addMethodTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  deliveryBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  deliveryTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  deliveryText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  footNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.lg, lineHeight: 18 },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  confirmBtn: {
    backgroundColor: Colors.secondary,
    minHeight: 54,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: Colors.black, fontWeight: '900', fontSize: FontSize.md },
  disabled: { opacity: 0.55 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    minHeight: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
  okBox: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
  okText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },

  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalBackdrop: { flex: 1 },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetClose: { width: 40 },
  sheetTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetIconBlue: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconPix: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: '#32BCAD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPixMark: { color: Colors.white, fontWeight: '900', fontSize: FontSize.sm },
  sheetRowTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  sheetRowSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
