import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { getDeliveryById, businessCancelDelivery } from '@/services/deliveryService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp, formatCurrency, formatDate, formatPhone } from '@/utils/links';
import { useAppAuth } from '@/hooks/useAppAuth';
import { updateDeliveryStatus } from '@/services/deliveryService';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando motoboy', color: Colors.warning },
  assigned: { label: 'Motoboy a caminho', color: Colors.info },
  collected: { label: 'Pedido coletado', color: Colors.primary },
  delivered: { label: 'Entregue', color: Colors.success },
  cancelled: { label: 'Cancelado', color: Colors.error },
};

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const { profile } = useAppAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isBusiness = profile?.user_type === 'business';
  const isCustomer = profile?.user_type === 'customer';

  const loadDelivery = useCallback(async () => {
    if (!id) return;
    const data = await getDeliveryById(id);
    setDelivery(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadDelivery(); }, [loadDelivery]);

  const handleAcceptByBusiness = async () => {
    if (!delivery) return;
    setAccepting(true);
    const { error } = await updateDeliveryStatus(delivery.id, 'pending', {
      business_accepted_at: new Date().toISOString()
    });
    setAccepting(false);
    if (error) showAlert('Erro', error);
    else loadDelivery();
  };

  const handleCancel = () => {
    if (!delivery || delivery.status !== 'pending') return;
    showAlert('Cancelar entrega?', 'Esta ação não pode ser desfeita.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar entrega', style: 'destructive', onPress: async () => {
          setCancelling(true);
          const { error } = await businessCancelDelivery(delivery.id);
          setCancelling(false);
          if (error) {
            showAlert('Erro ao cancelar', error);
          } else {
            showAlert('Pedido Cancelado', 'O pedido foi cancelado e o estorno foi solicitado ao Mercado Pago.');
            router.back();
          }
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  if (!delivery) {
    return <View style={styles.center}><Text style={styles.errorText}>Entrega não encontrada</Text></View>;
  }

  const st = STATUS_LABEL[delivery.status] ?? { label: delivery.status, color: Colors.textMuted };
  const motoboy = (delivery as any).motoboys;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Entrega</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        <View style={{ paddingHorizontal: Spacing.md }}>
          <View style={styles.statusCard}>
            <View style={[styles.statusBadge, { backgroundColor: st.color + '22' }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
            <Text style={styles.priceValue}>{formatCurrency(delivery.price)}</Text>
            <View style={styles.metaRow}>
              <MaterialIcons name="straighten" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>{delivery.distance_km} km</Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{formatDate(delivery.created_at)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <InfoRow label="Nome" value={delivery.customer_name} />
            <InfoRow label="Telefone" value={formatPhone(delivery.customer_phone)} />
            <InfoRow label="Endereço" value={`${delivery.customer_address}, ${delivery.customer_address_number}`} />
            {delivery.customer_complement ? <InfoRow label="Complemento" value={delivery.customer_complement} /> : null}
            <InfoRow label="Bairro" value={delivery.customer_neighborhood} />
            <InfoRow label="Cidade" value={`${delivery.customer_city} - ${delivery.customer_state}`} />
            {delivery.customer_cep ? <InfoRow label="CEP" value={delivery.customer_cep} /> : null}
          </View>

          {(() => {
            const raw = delivery.order_items as unknown;
            let items: { name?: string; quantity?: number; unit_price?: number }[] = [];
            if (Array.isArray(raw)) items = raw;
            else if (typeof raw === 'string') {
              try {
                const p = JSON.parse(raw);
                if (Array.isArray(p)) items = p;
              } catch { /* ignore */ }
            }
            if (items.length === 0) return null;
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Itens do pedido {delivery.order_source === 'app' ? '(app)' : ''}</Text>
                {items.map((it, idx) => (
                  <View key={idx} style={styles.itemLine}>
                    <Text style={styles.itemName}>
                      {it.quantity ?? 1}x {it.name ?? 'Item'}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {formatCurrency((it.unit_price ?? 0) * (it.quantity ?? 1))}
                    </Text>
                  </View>
                ))}
                {delivery.order_subtotal != null ? (
                  <Text style={styles.subtotal}>Subtotal itens: {formatCurrency(Number(delivery.order_subtotal))}</Text>
                ) : null}
              </View>
            );
          })()}

          {delivery.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observações</Text>
              <Text style={styles.notesText}>{delivery.notes}</Text>
            </View>
          ) : null}

          {motoboy && (
            <View style={styles.motoboyContactCard}>
              <View style={styles.motoboyContactHeader}>
                <MaterialIcons name="two-wheeler" size={20} color={Colors.secondary} />
                <Text style={styles.motoboyContactTitle}>Motoboy Atribuído</Text>
              </View>
              <Text style={styles.motoboyName}>{motoboy.name}</Text>
              <Text style={styles.motoboyPhone}>{formatPhone(motoboy.phone)}</Text>
              <TouchableOpacity
                style={styles.whatsappMotoboyBtn}
                onPress={() => openWhatsApp(motoboy.phone, `Olá ${motoboy.name}! Preciso de informações sobre o pedido de ${delivery.customer_name}.`)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat" size={20} color={Colors.white} />
                <Text style={styles.whatsappMotoboyText}>Chamar Motoboy no WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contato do Cliente</Text>
            <TouchableOpacity
              style={styles.whatsappRow}
              onPress={() => openWhatsApp(delivery.customer_phone, `Olá ${delivery.customer_name}! Atualização sobre sua entrega...`)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="chat" size={18} color={Colors.white} />
              <Text style={styles.whatsappText}>Chamar Cliente no WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {/* Botões de Ação Dinâmicos */}
          <View style={{ marginTop: Spacing.md }}>
            {/* 1. Comércio aceita o pedido */}
            {isBusiness && delivery.status === 'pending' && !delivery.business_accepted_at && (
              <TouchableOpacity
                style={[styles.primaryBtn, accepting && { opacity: 0.7 }]}
                onPress={handleAcceptByBusiness}
                disabled={accepting}
              >
                {accepting ? <ActivityIndicator color={Colors.white} /> : (
                  <>
                    <MaterialIcons name="check-circle" size={22} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Aceitar e Chamar Entregador</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* 2. Cliente acompanha a entrega */}
            {isCustomer && (delivery.status === 'assigned' || delivery.status === 'collected') && (
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => router.push(`/(customer)/track-delivery?id=${delivery.id}`)}
              >
                <MaterialIcons name="map" size={22} color={Colors.white} />
                <Text style={styles.trackBtnText}>Acompanhar Entrega no Mapa</Text>
              </TouchableOpacity>
            )}
          </View>

          {delivery.status === 'pending' && !delivery.motoboy_id && (
            <TouchableOpacity
              style={[styles.cancelBtn, cancelling && styles.btnDisabled, { marginTop: Spacing.md }]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? <ActivityIndicator color={Colors.error} /> : (
                <>
                  <MaterialIcons name="cancel" size={18} color={Colors.error} />
                  <Text style={styles.cancelBtnText}>Cancelar entrega</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  value: { fontSize: FontSize.sm, color: Colors.text, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.md },

  statusCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 6, marginBottom: Spacing.sm },
  statusText: { fontWeight: '700', fontSize: FontSize.sm },
  priceValue: { fontSize: 36, fontWeight: '800', color: Colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  metaSep: { color: Colors.textMuted },

  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  itemLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: FontSize.sm, color: Colors.text, flex: 1, marginRight: 8 },
  itemPrice: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  subtotal: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm, fontWeight: '600' },
  notesText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  whatsappRow: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm,
  },
  whatsappText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },

  // Motoboy contact card
  motoboyContactCard: {
    backgroundColor: Colors.secondary + '15',
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.secondary + '55',
  },
  motoboyContactHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 8 },
  motoboyContactTitle: { fontSize: FontSize.xs, color: Colors.secondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  motoboyName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  motoboyPhone: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  whatsappMotoboyBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
  },
  whatsappMotoboyText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  primaryBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.success,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
  trackBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.info,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  trackBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
  cancelBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  btnDisabled: { opacity: 0.6 },
  cancelBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.md },
});
