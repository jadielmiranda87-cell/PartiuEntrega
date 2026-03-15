import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useRides } from '@/contexts/RidesContext';
import { getDeliveryById, updateDeliveryStatus, cancelDelivery } from '@/services/deliveryService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWaze, openWhatsApp, formatCurrency, formatPhone } from '@/utils/links';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { showAlert } = useAlert();
  const { isSoundPlaying, stopAlertSound } = useRides();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadDelivery = useCallback(async () => {
    if (!id) return;
    const data = await getDeliveryById(id);
    setDelivery(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadDelivery(); }, [loadDelivery]);

  // Stop sound when entering ride detail (ride accepted)
  useEffect(() => {
    stopAlertSound();
  }, []);



  // ── Cancel / refuse ride (only before collect) ───────────────────────────
  const handleCancel = () => {
    showAlert(
      'Cancelar corrida?',
      'A corrida voltará para a fila disponível. Tem certeza?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            if (!delivery) return;
            setCancelling(true);
            const { error } = await cancelDelivery(delivery.id);
            setCancelling(false);
            if (error) {
              showAlert('Erro', 'Não foi possível cancelar. Tente novamente.');
              return;
            }
            router.replace('/(motoboy)');
          },
        },
      ]
    );
  };

  // ── Collect ──────────────────────────────────────────────────────────────
  const handleCollect = async () => {
    if (!delivery) return;
    setUpdating(true);
    const { error } = await updateDeliveryStatus(delivery.id, 'collected', { collected_at: new Date().toISOString() });
    setUpdating(false);
    if (error) { showAlert('Erro', error); return; }
    setDelivery({ ...delivery, status: 'collected', collected_at: new Date().toISOString() } as Delivery);
  };

  // ── Deliver ──────────────────────────────────────────────────────────────
  const handleDeliver = async () => {
    if (!delivery) return;
    showAlert('Confirmar entrega', 'A entrega foi concluída com sucesso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          setUpdating(true);
          const { error } = await updateDeliveryStatus(delivery.id, 'delivered', { delivered_at: new Date().toISOString() });
          setUpdating(false);
          if (error) { showAlert('Erro', error); return; }
          showAlert('Entregue!', 'Parabéns! Corrida concluída.', [
            { text: 'OK', onPress: () => router.replace('/(motoboy)') }
          ]);
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondary} /></View>;
  }

  if (!delivery) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Corrida não encontrada</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const biz = (delivery as any).businesses;
  const isCollecting = delivery.status === 'assigned';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isCollecting ? 'Ir Buscar' : 'Entregar'}</Text>

        {/* Right side: mute button (only if sound playing) OR cancel text OR spacer */}
        {isSoundPlaying ? (
          <TouchableOpacity
            onPress={() => stopAlertSound()}
            style={styles.muteBtnHeader}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="volume-off" size={18} color={Colors.warning} />
            <Text style={styles.muteHeaderText}>Silenciar</Text>
          </TouchableOpacity>
        ) : isCollecting ? (
          <TouchableOpacity
            onPress={handleCancel}
            disabled={cancelling}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerCancelBtn}
          >
            {cancelling
              ? <ActivityIndicator size="small" color={Colors.error} />
              : <Text style={styles.headerCancelText}>Cancelar</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Summary banner ── */}
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <MaterialIcons name="attach-money" size={20} color={Colors.primary} />
            <Text style={styles.summaryValue}>{formatCurrency(delivery.price)}</Text>
            <Text style={styles.summaryLabel}>Valor</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <MaterialIcons name="straighten" size={20} color={Colors.secondary} />
            <Text style={styles.summaryValue}>{delivery.distance_km} km</Text>
            <Text style={styles.summaryLabel}>Distância</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <MaterialIcons name={isCollecting ? 'store' : 'location-on'} size={20} color={isCollecting ? Colors.warning : Colors.error} />
            <Text style={styles.summaryValue}>{isCollecting ? 'Coleta' : 'Entrega'}</Text>
            <Text style={styles.summaryLabel}>Etapa</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: Spacing.md }}>
          {/* Phase indicator */}
          <View style={styles.phaseBar}>
            <View style={[styles.phaseStep, styles.phaseStepActive]}>
              <MaterialIcons name="store" size={18} color={Colors.white} />
              <Text style={styles.phaseText}>Coleta</Text>
            </View>
            <View style={[styles.phaseConnector, !isCollecting && styles.phaseConnectorDone]} />
            <View style={[styles.phaseStep, !isCollecting && styles.phaseStepActive, isCollecting && styles.phaseStepPending]}>
              <MaterialIcons name="location-on" size={18} color={isCollecting ? Colors.textMuted : Colors.white} />
              <Text style={[styles.phaseText, isCollecting && { color: Colors.textMuted }]}>Entrega</Text>
            </View>
          </View>

          {/* Current destination card */}
          {isCollecting ? (
            <View style={styles.destinationCard}>
              <View style={styles.destinationHeader}>
                <MaterialIcons name="store" size={22} color={Colors.primary} />
                <Text style={styles.destinationTitle}>Buscar no Comércio</Text>
              </View>
              <Text style={styles.destinationName}>{biz?.name}</Text>
              <Text style={styles.destinationAddress}>{biz?.address}, {biz?.address_number}</Text>
              <Text style={styles.destinationAddress}>{biz?.neighborhood} — {biz?.city}/{biz?.state}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.wazeBtn}
                  onPress={() => openWaze(biz?.address ?? '', biz?.address_number ?? '', biz?.city ?? '', biz?.state ?? '')}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={18} color={Colors.white} />
                  <Text style={styles.wazeBtnText}>Abrir no Waze</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={() => openWhatsApp(biz?.phone ?? '', `Olá! Estou indo buscar o pedido de ${delivery.customer_name}.`)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="chat" size={18} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.destinationCard}>
              <View style={styles.destinationHeader}>
                <MaterialIcons name="location-on" size={22} color={Colors.error} />
                <Text style={styles.destinationTitle}>Entregar ao Cliente</Text>
              </View>
              <Text style={styles.destinationName}>{delivery.customer_name}</Text>
              <Text style={styles.destinationAddress}>{delivery.customer_address}, {delivery.customer_address_number}</Text>
              {delivery.customer_complement ? <Text style={styles.destinationAddress}>{delivery.customer_complement}</Text> : null}
              <Text style={styles.destinationAddress}>{delivery.customer_neighborhood} — {delivery.customer_city}/{delivery.customer_state}</Text>
              {delivery.customer_cep ? <Text style={styles.destinationAddress}>CEP: {delivery.customer_cep}</Text> : null}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.wazeBtn}
                  onPress={() => openWaze(delivery.customer_address, delivery.customer_address_number, delivery.customer_city, delivery.customer_state)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={18} color={Colors.white} />
                  <Text style={styles.wazeBtnText}>Abrir no Waze</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={() => openWhatsApp(delivery.customer_phone, `Olá ${delivery.customer_name}! Estou a caminho com sua entrega.`)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="chat" size={18} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Customer info (after collect) */}
          {!isCollecting && (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={18} color={Colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>Telefone do Cliente</Text>
                  <TouchableOpacity onPress={() => openWhatsApp(delivery.customer_phone, `Olá ${delivery.customer_name}! Estou a caminho com sua entrega.`)} activeOpacity={0.8}>
                    <Text style={styles.infoPhone}>{formatPhone(delivery.customer_phone)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {delivery.notes ? (
                <View style={styles.notesRow}>
                  <MaterialIcons name="notes" size={16} color={Colors.textMuted} />
                  <Text style={styles.notesText}>{delivery.notes}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Commerce info (on collect step) */}
          {isCollecting && biz?.phone ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={18} color={Colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>Telefone do Comércio</Text>
                  <TouchableOpacity onPress={() => openWhatsApp(biz.phone, `Olá! Sou motoboy do PartiuEntrega, estou indo buscar o pedido.`)} activeOpacity={0.8}>
                    <Text style={styles.infoPhone}>{formatPhone(biz.phone)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {/* Primary action button */}
          {isCollecting ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.collectBtn, updating && styles.btnDisabled]}
                onPress={handleCollect}
                disabled={updating}
                activeOpacity={0.8}
              >
                {updating ? <ActivityIndicator color={Colors.white} /> : (
                  <>
                    <MaterialIcons name="check-circle" size={22} color={Colors.white} />
                    <Text style={styles.actionBtnText}>Confirmei a Coleta</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelRideBtn, (cancelling || updating) && styles.btnDisabled]}
                onPress={handleCancel}
                disabled={cancelling || updating}
                activeOpacity={0.8}
              >
                {cancelling ? <ActivityIndicator color={Colors.error} size="small" /> : (
                  <>
                    <MaterialIcons name="cancel" size={18} color={Colors.error} />
                    <Text style={styles.cancelRideBtnText}>Cancelar corrida</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.deliverBtn, updating && styles.btnDisabled]}
              onPress={handleDeliver}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating ? <ActivityIndicator color={Colors.white} /> : (
                <>
                  <MaterialIcons name="check-circle" size={22} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Confirmar Entrega</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  headerCancelBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  headerCancelText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '700' },
  muteBtnHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '22', borderRadius: BorderRadius.sm,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.warning + '55',
  },
  muteHeaderText: { color: Colors.warning, fontSize: FontSize.xs, fontWeight: '700' },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.md },
  backLink: { color: Colors.primary, marginTop: Spacing.sm, fontSize: FontSize.md },

  summaryBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  summaryDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  phaseBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  phaseStep: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 8,
  },
  phaseStepActive: { backgroundColor: Colors.primary },
  phaseStepPending: { backgroundColor: Colors.surfaceElevated },
  phaseText: { color: Colors.white, fontWeight: '600', fontSize: FontSize.sm },
  phaseConnector: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  phaseConnectorDone: { backgroundColor: Colors.primary },



  destinationCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  destinationHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  destinationTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  destinationName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  destinationAddress: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  wazeBtn: {
    flex: 1, flexDirection: 'row', gap: 8, backgroundColor: '#00A4FF',
    borderRadius: BorderRadius.md, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  wazeBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  whatsappBtn: {
    backgroundColor: '#25D366', borderRadius: BorderRadius.md,
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
  },

  infoCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoTitle: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500', marginBottom: 2 },
  infoPhone: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.secondary },
  notesRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'flex-start' },
  notesText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },

  actionBtn: {
    flexDirection: 'row', gap: Spacing.sm, borderRadius: BorderRadius.md,
    height: 58, alignItems: 'center', justifyContent: 'center',
  },
  collectBtn: { backgroundColor: Colors.primary },
  deliverBtn: { backgroundColor: Colors.success },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '700' },

  cancelRideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: Spacing.sm, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.error + '88',
    borderRadius: BorderRadius.md,
  },
  cancelRideBtnText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '600' },
});
