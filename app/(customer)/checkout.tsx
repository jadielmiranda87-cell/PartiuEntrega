import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useCart } from '@/contexts/CartContext';
import { getBusinessById } from '@/services/catalogService';
import { createDelivery, getCustomerDeliveries } from '@/services/deliveryService';
import { getAppConfig } from '@/services/configService';
import { geocodeAddress, getDrivingDistanceKm, reverseGeocode, haversineKm, type GeoLocation, type GeocodeResult } from '@/services/mapsService';
import { requestLocationPermission } from '@/services/permissionsService';
import { addressFormFromGeocode } from '@/utils/addressFromGeocode';
import type { Business, BusinessBillingPlan, Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';
import { parseConfigDecimal } from '@/utils/parseConfigDecimal';
import { isBusinessOpenNow } from '@/utils/openingHours';
import { useAlert } from '@/template';
import { consumeCheckoutMapPickerResult } from '@/services/checkoutMapPickerResult';

function businessGeoString(b: Business): string {
  return `${b.address}, ${b.address_number}, ${b.neighborhood}, ${b.city}, ${b.state}, ${b.cep}, Brasil`;
}

function businessHasSavedCoords(b: Business): b is Business & { latitude: number; longitude: number } {
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
         Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001 &&
         Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function deliveryAddressKey(d: Delivery): string {
  return [
    (d.customer_address || '').toLowerCase().trim(),
    (d.customer_address_number || '').toLowerCase().trim(),
    (d.customer_neighborhood || '').toLowerCase().trim(),
    (d.customer_city || '').toLowerCase().trim(),
    (d.customer_state || '').toLowerCase().trim(),
  ].join('|');
}

function uniqueSavedDeliveries(deliveries: Delivery[]): Delivery[] {
  const seen = new Set<string>();
  const out: Delivery[] = [];
  for (const d of deliveries) {
    if (!d.customer_address?.trim()) continue;
    const k = deliveryAddressKey(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
    if (out.length >= 12) break;
  }
  return out;
}

export default function CheckoutScreen() {
  const { profile, userId } = useAppAuth();
  const { lines, subtotal, businessId, clearCart } = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [business, setBusiness] = useState<Business | null>(null);
  const [name, setName] = useState(profile?.username ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [customerCep, setCustomerCep] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [customerComplement, setCustomerComplement] = useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [notes, setNotes] = useState('');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [deliveryPin, setDeliveryPin] = useState<GeoLocation | null>(null);
  const [pricePerKm, setPricePerKm] = useState(2.5);
  const [minPrice, setMinPrice] = useState(8);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [orderHistoryLoaded, setOrderHistoryLoaded] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(true);
  const [pastDeliveries, setPastDeliveries] = useState<Delivery[]>([]);
  const [showFirstOrderModal, setShowFirstOrderModal] = useState(false);
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState(false);
  const [calcDist, setCalcDist] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const billingPlan: BusinessBillingPlan = business?.billing_plan ?? 'delivery';
  const isBasicPlan = billingPlan === 'basic';

  const savedList = useMemo(() => uniqueSavedDeliveries(pastDeliveries), [pastDeliveries]);

  useEffect(() => {
    if (profile?.username) setName(profile.username);
    if (profile?.phone) setPhone(profile.phone);
  }, [profile?.username, profile?.phone]);

  useEffect(() => {
    getAppConfig().then((c) => {
      setPricePerKm(parseConfigDecimal(c.price_per_km, 2.5));
      setMinPrice(parseConfigDecimal(c.min_delivery_price, 8));
    });
  }, []);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoadingBiz(true);
      const b = await getBusinessById(businessId);
      setBusiness(b);
      setLoadingBiz(false);
    })();
  }, [businessId]);

  useEffect(() => {
    if (!userId) {
      setPastDeliveries([]);
      setIsFirstOrder(true);
      setOrderHistoryLoaded(true);
      return;
    }
    (async () => {
      const list = await getCustomerDeliveries(userId);
      setPastDeliveries(list);
      setIsFirstOrder(list.length === 0);
      setOrderHistoryLoaded(true);
    })();
  }, [userId]);

  useEffect(() => {
    if (orderHistoryLoaded && isFirstOrder) {
      setShowFirstOrderModal(true);
    }
  }, [orderHistoryLoaded, isFirstOrder]);

  const rawDeliveryFee =
    distanceKm != null && !Number.isNaN(distanceKm) ? Math.max(minPrice, distanceKm * pricePerKm) : null;
  const deliveryFeeCharged = isBasicPlan ? (rawDeliveryFee != null ? 0 : null) : rawDeliveryFee;
  const total = subtotal + (deliveryFeeCharged ?? 0);

  const fillFromGeocode = useCallback((geo: GeocodeResult, pin: GeoLocation | null) => {
    const f = addressFormFromGeocode(geo);
    setCustomerAddress(f.customerAddress);
    setCustomerNumber(f.customerNumber);
    setCustomerNeighborhood(f.customerNeighborhood);
    setCustomerCity(f.customerCity);
    setCustomerState(f.customerState);
    setCustomerCep(f.customerCep);
    setDeliveryPin(pin);
    setDistanceKm(null);
  }, []);

  const openMapPicker = useCallback(
    (initial?: { lat: number; lng: number }) => {
      setShowFirstOrderModal(false);
      setShowSavedAddressesModal(false);
      router.push({
        pathname: '/(customer)/delivery-map-picker',
        params: initial ? { lat: String(initial.lat), lng: String(initial.lng) } : {},
      });
    },
    [router]
  );

  const useCurrentLocation = useCallback(async () => {
    const perm = await requestLocationPermission();
    if (!perm.granted) {
      showAlert('Localização', perm.reason);
      return;
    }
    setLoadingGps(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      openMapPicker({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setLoadingGps(false);
    }
  }, [openMapPicker, showAlert]);

  useFocusEffect(
    useCallback(() => {
      const r = consumeCheckoutMapPickerResult();
      if (!r) return;
      if (r.geocode) {
        fillFromGeocode(r.geocode, { lat: r.lat, lng: r.lng });
      } else {
        setDeliveryPin({ lat: r.lat, lng: r.lng });
        void reverseGeocode(r.lat, r.lng).then((g) => {
          if (g) fillFromGeocode(g, { lat: r.lat, lng: r.lng });
        });
      }
    }, [fillFromGeocode])
  );

  const applySavedDelivery = useCallback(
    (d: Delivery) => {
      setCustomerAddress(d.customer_address ?? '');
      setCustomerNumber(d.customer_address_number ?? '');
      setCustomerComplement(d.customer_complement ?? '');
      setCustomerNeighborhood(d.customer_neighborhood ?? '');
      setCustomerCity(d.customer_city ?? '');
      setCustomerState((d.customer_state ?? '').toUpperCase().slice(0, 2));
      setCustomerCep((d.customer_cep ?? '').replace(/\D/g, ''));
      const lat = d.delivery_lat != null ? Number(d.delivery_lat) : NaN;
      const lng = d.delivery_lng != null ? Number(d.delivery_lng) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setDeliveryPin({ lat, lng });
      } else {
        setDeliveryPin(null);
      }
      setDistanceKm(null);
      setShowSavedAddressesModal(false);
      setShowFirstOrderModal(false);
    },
    []
  );

  const recalculateDelivery = useCallback(
    async (silent: boolean) => {
      if (!business) return;
      setCalcDist(true);
      try {
        let origin: GeoLocation;
        if (businessHasSavedCoords(business)) {
          origin = { lat: Number(business.latitude), lng: Number(business.longitude) };
        } else {
          const geoBiz = await geocodeAddress(businessGeoString(business));
          if (!geoBiz?.location) {
            setDistanceKm(null);
            if (!silent) showAlert('Erro', 'Localização do restaurante não encontrada.');
            return;
          }
          origin = geoBiz.location;
        }

        let destPoint: GeoLocation | null = deliveryPin;
        if (!destPoint) {
          const destStr = `${customerAddress}, ${customerNumber}, ${customerNeighborhood}, ${customerCity}, ${customerState}, ${customerCep}, Brasil`;
          const geoDest = await geocodeAddress(destStr);
          if (!geoDest?.location) {
            setDistanceKm(null);
            return;
          }
          destPoint = geoDest.location;
        }

        const dist = await getDrivingDistanceKm(origin, destPoint);
        if (!dist) {
          const straight = haversineKm(origin, destPoint);
          setDistanceKm(Math.round(straight * 1.25 * 10) / 10);
        } else {
          setDistanceKm(dist.km);
        }
      } catch (err) {
        console.error('[Checkout] Recalculate err:', err);
      } finally {
        setCalcDist(false);
      }
    },
    [business, customerAddress, customerNumber, customerNeighborhood, customerCity, customerState, customerCep, deliveryPin, showAlert]
  );

  const addressComplete =
    !!customerAddress.trim() &&
    !!customerNumber.trim() &&
    !!customerNeighborhood.trim() &&
    !!customerCity.trim() &&
    !!customerState.trim();

  useEffect(() => {
    if (!business || !addressComplete) return;
    const t = setTimeout(() => {
      void recalculateDelivery(true);
    }, 800);
    return () => clearTimeout(t);
  }, [
    business,
    addressComplete,
    customerAddress,
    customerNumber,
    customerNeighborhood,
    customerCity,
    customerState,
    customerCep,
    deliveryPin,
    recalculateDelivery,
  ]);

  const handleSubmit = async () => {
    if (!business || !userId || lines.length === 0) return;
    if (!name.trim() || !phone.trim()) {
      showAlert('Dados', 'Informe nome e telefone.');
      return;
    }
    if (!addressComplete) {
      showAlert('Endereço', 'Preencha o endereço completo.');
      return;
    }
    if (distanceKm == null) {
      showAlert('Entrega', 'Aguarde o cálculo do frete.');
      return;
    }

    setSubmitting(true);
    const deliveryPayload: any = {
      business_id: business.id,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_address: customerAddress.trim(),
      customer_address_number: customerNumber.trim(),
      customer_complement: customerComplement.trim() || undefined,
      customer_neighborhood: customerNeighborhood.trim(),
      customer_city: customerCity.trim(),
      customer_state: customerState.trim().toUpperCase().slice(0, 2),
      customer_cep: customerCep.replace(/\D/g, ''),
      distance_km: distanceKm,
      price: Math.round(total * 100) / 100,
      order_subtotal: Math.round(subtotal * 100) / 100,
      order_items: lines.map(l => ({
        product_id: l.productId,
        name: l.productName,
        quantity: l.quantity,
        unit_price: l.unitPrice,
      })),
      order_source: 'app',
      customer_user_id: userId,
      notes: notes.trim() || `Pedido app — ${lines.length} item(ns)`,
      status: 'pending',
      payment_status: 'awaiting_payment',
    };

    // Só envia as coordenadas se o pino foi marcado e elas existem na tabela
    if (deliveryPin?.lat && deliveryPin?.lng) {
      deliveryPayload.delivery_lat = deliveryPin.lat;
      deliveryPayload.delivery_lng = deliveryPin.lng;
    }

    const { data: created, error } = await createDelivery(deliveryPayload);
    setSubmitting(false);
    if (error || !created) {
      showAlert('Erro', error ?? 'Falha ao criar pedido.');
      return;
    }
    clearCart();
    router.replace(`/(customer)/order-payment?id=${created.id}`);
  };

  if (!businessId || lines.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.textSecondary }}>Carrinho vazio</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingBiz || !business || !orderHistoryLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Modal visible={showFirstOrderModal} transparent animationType="fade" onRequestClose={() => setShowFirstOrderModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFirstOrderModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>É o seu primeiro pedido?</Text>
            <Text style={styles.modalSubtitle}>
              Use o mapa para marcar o local exato da entrega para garantir que o motoboy encontre você rápido.
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={useCurrentLocation} disabled={loadingGps}>
              {loadingGps ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalPrimaryText}>Abrir mapa</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowFirstOrderModal(false)}>
              <Text style={styles.modalSecondaryText}>Preencher manual</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSavedAddressesModal} transparent animationType="slide" onRequestClose={() => setShowSavedAddressesModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSavedAddressesModal(false)}>
          <Pressable style={[styles.modalCard, styles.savedSheet]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Endereços anteriores</Text>
            <FlatList
              data={savedList}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.savedRow} onPress={() => applySavedDelivery(item)}>
                  <MaterialIcons name="history" size={22} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedMain}>{item.customer_address}, {item.customer_address_number}</Text>
                    <Text style={styles.savedSub}>{item.customer_neighborhood} · {item.customer_city}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowSavedAddressesModal(false)}>
              <Text style={styles.modalSecondaryText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 120, paddingTop: Spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.bizLabel}>Pedido em</Text>
        <Text style={styles.bizName}>{business.name}</Text>

        {!isBusinessOpenNow(business.opening_hours) && (
          <View style={styles.closedBanner}>
            <MaterialIcons name="schedule" size={20} color={Colors.error} />
            <Text style={styles.closedBannerText}>O restaurante está fechado agora.</Text>
          </View>
        )}

        <Text style={styles.section}>Seus dados</Text>
        <TextInput style={styles.input} placeholder="Nome completo" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.section}>Endereço de entrega</Text>

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickBtn, styles.quickBtnPrimary]} onPress={useCurrentLocation} disabled={loadingGps}>
            <MaterialIcons name="my-location" size={20} color={Colors.white} />
            <Text style={styles.quickBtnPrimaryText}>Usar GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, styles.quickBtnOutline]} onPress={() => setShowSavedAddressesModal(true)}>
            <MaterialIcons name="history" size={20} color={Colors.primary} />
            <Text style={styles.quickBtnOutlineText}>Salvos</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mapAdjustRow} onPress={() => openMapPicker(deliveryPin ? { lat: deliveryPin.lat, lng: deliveryPin.lng } : undefined)}>
          <MaterialIcons name="edit-location-alt" size={22} color={Colors.info} />
          <Text style={styles.mapAdjustText}>Ajustar no mapa</Text>
          <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
        </TouchableOpacity>

        <TextInput style={styles.input} placeholder="CEP" value={customerCep} onChangeText={setCustomerCep} keyboardType="number-pad" />
        <TextInput style={styles.input} placeholder="Rua / Avenida" value={customerAddress} onChangeText={setCustomerAddress} />
        <TextInput style={styles.input} placeholder="Número" value={customerNumber} onChangeText={setCustomerNumber} />
        <TextInput style={styles.input} placeholder="Complemento" value={customerComplement} onChangeText={setCustomerComplement} />
        <TextInput style={styles.input} placeholder="Bairro" value={customerNeighborhood} onChangeText={setCustomerNeighborhood} />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TextInput style={[styles.input, { flex: 2 }]} placeholder="Cidade" value={customerCity} onChangeText={setCustomerCity} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="UF" value={customerState} onChangeText={setCustomerState} maxLength={2} />
        </View>

        {calcDist && (
          <View style={styles.calcHintRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.calcHintText}>Calculando frete…</Text>
          </View>
        )}

        <TextInput style={[styles.input, { minHeight: 72 }]} placeholder="Observações" value={notes} onChangeText={setNotes} multiline />

        <View style={styles.summary}>
          <Row label="Subtotal" value={formatCurrency(subtotal)} />
          <Row label="Taxa de entrega" value={calcDist ? '...' : (deliveryFeeCharged != null ? formatCurrency(deliveryFeeCharged) : '—')} />
          <Row label="Total" value={formatCurrency(total)} bold />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Confirmar pedido</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: Colors.textSecondary, fontWeight: bold ? '800' : '500' }}>{label}</Text>
      <Text style={{ color: Colors.text, fontWeight: bold ? '800' : '700' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bizLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  bizName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  closedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.error + '18', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  closedBannerText: { fontSize: FontSize.sm, color: Colors.text },
  section: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: 12, color: Colors.text, marginBottom: Spacing.sm },
  quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: BorderRadius.md },
  quickBtnPrimary: { backgroundColor: Colors.primary },
  quickBtnPrimaryText: { color: Colors.white, fontWeight: '800' },
  quickBtnOutline: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary },
  quickBtnOutlineText: { color: Colors.primary, fontWeight: '800' },
  mapAdjustRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: 12, marginBottom: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.info + '55' },
  mapAdjustText: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  calcHintRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  calcHintText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  summary: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  submitBtn: { marginTop: Spacing.lg, backgroundColor: Colors.primary, height: 54, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  savedSheet: { maxHeight: '80%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  modalPrimary: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.sm },
  modalPrimaryText: { color: Colors.white, fontWeight: '800' },
  modalSecondary: { paddingVertical: 12, borderRadius: BorderRadius.md, alignItems: 'center' },
  modalSecondaryText: { color: Colors.text, fontWeight: '700' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  savedMain: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  savedSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
