import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useRides } from '@/contexts/RidesContext';
import {
  getDeliveryById,
  cancelDelivery,
  markCollectedWithHandoffCode,
  confirmDeliveryWithCode,
  updateMotoboyLocation,
} from '@/services/deliveryService';
import { resolveDeliveryEndpoints } from '@/services/deliveryGeo';
import { DeliveryRouteMap } from '@/components/DeliveryRouteMap';
import type { GeoLocation } from '@/services/mapsService';
import { Delivery, Business } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWaze, openWhatsApp, formatCurrency, formatPhone } from '@/utils/links';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppAuth } from '@/hooks/useAppAuth';
import { APP_SHORT_NAME, storageKey } from '@/constants/branding';

const pixKeyStorageKey = (motoboyId: string) => storageKey(`motoboyPixKey:${motoboyId}`);

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [geoEndpoints, setGeoEndpoints] = useState<{
    business: GeoLocation | null;
    customer: GeoLocation | null;
  } | null>(null);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const locationSentAtRef = useRef(0);

  const { showAlert } = useAlert();
  const { isSoundPlaying, stopAlertSound } = useRides();
  const { motoboyProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadDelivery = useCallback(async () => {
    if (!id) return;
    const data = await getDeliveryById(id);
    setDelivery(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadDelivery(); }, [loadDelivery]);

  useEffect(() => {
    if (!delivery) return;
    const bizRow = (delivery as unknown as { businesses?: Business }).businesses;
    let cancelled = false;
    (async () => {
      const e = await resolveDeliveryEndpoints(delivery, bizRow ?? null);
      if (!cancelled) setGeoEndpoints(e);
    })();
    return () => {
      cancelled = true;
    };
  }, [delivery?.id, delivery?.delivery_lat, delivery?.delivery_lng]);

  useEffect(() => {
    if (!delivery || !motoboyProfile?.id) return;
    if (delivery.status !== 'assigned' && delivery.status !== 'collected') return;

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 35,
          timeInterval: 12000,
        },
        async (loc) => {
          const now = Date.now();
          if (now - locationSentAtRef.current < 9000) return;
          locationSentAtRef.current = now;
          await updateMotoboyLocation(delivery.id, motoboyProfile.id, loc.coords.latitude, loc.coords.longitude);
        }
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [delivery?.id, delivery?.status, motoboyProfile?.id]);

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
    if (!delivery || !motoboyProfile?.id) return;
    setUpdating(true);
    const { data, error } = await markCollectedWithHandoffCode(delivery.id, motoboyProfile.id);
    setUpdating(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    if (data) setDelivery(data as Delivery);
    else {
      const refreshed = await getDeliveryById(delivery.id);
      if (refreshed) setDelivery(refreshed);
    }
  };

  const submitDeliveryCode = async () => {
    if (!delivery || !motoboyProfile?.id) return;
    const code = deliveryCodeInput.replace(/\D/g, '').trim();
    if (code.length !== 4) {
      showAlert('Código', 'Digite os 4 últimos dígitos do celular do cliente (iguais ao que ele vê no app).');
      return;
    }
    setUpdating(true);
    const { error } = await confirmDeliveryWithCode(delivery.id, motoboyProfile.id, code);
    setUpdating(false);
    if (error) {
      showAlert('Não foi possível concluir', error);
      return;
    }
    setCodeModalVisible(false);
    setDeliveryCodeInput('');
    router.replace('/(motoboy)');
  };

  // ── Deliver (pede código do cliente) ───────────────────────────────────────
  const handleDeliver = () => {
    setDeliveryCodeInput('');
    setCodeModalVisible(true);
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

  const handleSendPix = async () => {
    if (!motoboyProfile?.id) {
      showAlert('Erro', 'Perfil do motoboy não carregado.');
      return;
    }
    const key = (await AsyncStorage.getItem(pixKeyStorageKey(motoboyProfile.id)))?.trim();
    if (!key) {
      showAlert('Chave Pix não cadastrada', 'Vá em Perfil → aba Pix e cadastre sua chave Pix antes de enviar.');
      return;
    }
    const msg =
      `Olá ${delivery.customer_name}! Segue minha chave Pix para pagamento da corrida:\n\n` +
      `${key}\n\n` +
      `${APP_SHORT_NAME}`;
    openWhatsApp(delivery.customer_phone, msg);
  };

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

      {geoEndpoints && (geoEndpoints.business || geoEndpoints.customer) ? (
        <DeliveryRouteMap
          phase={isCollecting ? 'pickup' : 'dropoff'}
          businessCoord={geoEndpoints.business}
          customerCoord={geoEndpoints.customer}
        />
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >

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
                  onPress={() =>
                    openWaze({
                      placeName: biz?.name,
                      address: biz?.address ?? '',
                      number: biz?.address_number,
                      neighborhood: biz?.neighborhood,
                      city: biz?.city ?? '',
                      state: biz?.state ?? '',
                      cep: biz?.cep,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={18} color={Colors.white} />
                  <Text style={styles.wazeBtnText}>Waze até o comércio</Text>
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
                  onPress={() =>
                    openWaze({
                      address: delivery.customer_address,
                      number: delivery.customer_address_number,
                      neighborhood: delivery.customer_neighborhood,
                      city: delivery.customer_city,
                      state: delivery.customer_state,
                      cep: delivery.customer_cep,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={18} color={Colors.white} />
                  <Text style={styles.wazeBtnText}>Waze até o cliente</Text>
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

          {/* After collect: contact cards for BOTH business and customer */}
          {!isCollecting && (
            <>
              {/* Comércio contact */}
              {biz?.phone ? (
                <View style={styles.contactCard}>
                  <View style={styles.contactCardHeader}>
                    <MaterialIcons name="store" size={18} color={Colors.primary} />
                    <Text style={styles.contactCardTitle}>Contato do Comércio</Text>
                  </View>
                  <Text style={styles.contactCardName}>{biz?.name}</Text>
                  <Text style={styles.contactCardPhone}>{formatPhone(biz.phone)}</Text>
                  <TouchableOpacity
                    style={[styles.whatsappContactBtn, { backgroundColor: Colors.primary + 'DD' }]}
                    onPress={() => openWhatsApp(biz.phone, `Olá! Já coletei o pedido e estou a caminho do cliente ${delivery.customer_name}.`)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="chat" size={18} color={Colors.white} />
                    <Text style={styles.whatsappContactText}>WhatsApp do Comércio</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Cliente contact */}
              <View style={styles.contactCard}>
                <View style={styles.contactCardHeader}>
                  <MaterialIcons name="person" size={18} color={Colors.secondary} />
                  <Text style={styles.contactCardTitle}>Contato do Cliente</Text>
                </View>
                <Text style={styles.contactCardName}>{delivery.customer_name}</Text>
                <Text style={styles.contactCardPhone}>{formatPhone(delivery.customer_phone)}</Text>
                <TouchableOpacity
                  style={[styles.whatsappContactBtn, { backgroundColor: '#25D366' }]}
                  onPress={() => openWhatsApp(delivery.customer_phone, `Olá ${delivery.customer_name}! Estou a caminho com sua entrega.`)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="chat" size={18} color={Colors.white} />
                  <Text style={styles.whatsappContactText}>WhatsApp do Cliente</Text>
                </TouchableOpacity>
                {delivery.notes ? (
                  <View style={styles.notesRow}>
                    <MaterialIcons name="notes" size={16} color={Colors.textMuted} />
                    <Text style={styles.notesText}>{delivery.notes}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.pixBtn, !motoboyProfile?.id && styles.btnDisabled]}
                  onPress={handleSendPix}
                  activeOpacity={0.8}
                  disabled={!motoboyProfile?.id}
                >
                  <MaterialIcons name="qr-code" size={18} color={Colors.white} />
                  <Text style={styles.pixBtnText}>Enviar chave Pix</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Commerce info (on collect step) */}
          {isCollecting && biz?.phone ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={18} color={Colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>Telefone do Comércio</Text>
                  <TouchableOpacity onPress={() => openWhatsApp(biz.phone, `Olá! Sou entregador do ${APP_SHORT_NAME}, estou indo buscar o pedido.`)} activeOpacity={0.8}>
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
            <>
              {delivery.handoff_code ? (
                <View style={styles.codeHintBox}>
                  <MaterialIcons name="smartphone" size={20} color={Colors.textSecondary} />
                  <Text style={styles.codeHintText}>
                    O código são os 4 últimos dígitos do celular do cliente — ele vê no app (mapa). Não envie por WhatsApp.
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.actionBtn, styles.deliverBtn, updating && styles.btnDisabled]}
                onPress={handleDeliver}
                disabled={updating}
                activeOpacity={0.8}
              >
                <MaterialIcons name="pin" size={22} color={Colors.white} />
                <Text style={styles.actionBtnText}>Finalizar entrega</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={codeModalVisible} animationType="fade" transparent onRequestClose={() => setCodeModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Código de entrega</Text>
            <Text style={styles.modalHint}>
              Peça os 4 últimos dígitos do celular do cliente (ele também vê no app, na tela do mapa).
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              value={deliveryCodeInput}
              onChangeText={setDeliveryCodeInput}
            />
            <TouchableOpacity
              style={[styles.actionBtn, styles.deliverBtn, updating && styles.btnDisabled]}
              onPress={submitDeliveryCode}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color={Colors.white} /> : (
                <Text style={styles.actionBtnText}>Confirmar e concluir</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setCodeModalVisible(false); setDeliveryCodeInput(''); }}>
              <Text style={styles.modalCancelText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Contact cards (after collect)
  contactCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  contactCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  contactCardTitle: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  contactCardName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  contactCardPhone: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  whatsappContactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: BorderRadius.md, height: 44,
  },
  whatsappContactText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  pixBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: BorderRadius.md, height: 44,
    marginTop: Spacing.sm,
    backgroundColor: Colors.secondary,
  },
  pixBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.sm },

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

  codeHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeHintText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  modalHint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 8,
    color: Colors.text,
    textAlign: 'center',
  },
  modalCancel: { alignItems: 'center', paddingVertical: Spacing.sm },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
});
