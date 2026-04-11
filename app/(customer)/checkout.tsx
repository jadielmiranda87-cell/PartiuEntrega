import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useCart } from '@/contexts/CartContext';
import { getBusinessById } from '@/services/catalogService';
import { createDelivery } from '@/services/deliveryService';
import { getAppConfig } from '@/services/configService';
import { geocodeAddress, reverseGeocode, geocodeResultToBrazilianParts } from '@/services/mapsService';
import { requestLocationPermission } from '@/services/permissionsService';
import { getOsrmDistanceKm } from '@/utils/distance';
import type { Business, OrderItemLine } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';
import { isBusinessOpenNow } from '@/utils/openingHours';
import { useAlert } from '@/template';

function businessGeoString(b: Business): string {
  return `${b.address}, ${b.address_number}, ${b.neighborhood}, ${b.city}, ${b.state}, ${b.cep}, Brasil`;
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
  const [manualKm, setManualKm] = useState('');
  const [pricePerKm, setPricePerKm] = useState(2.5);
  const [minPrice, setMinPrice] = useState(8);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [calcDist, setCalcDist] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Destino da entrega em coordenadas (GPS ou último geocoding do endereço). */
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const fillingAddressRef = useRef(false);

  useEffect(() => {
    if (profile?.username) setName(profile.username);
    if (profile?.phone) setPhone(profile.phone);
  }, [profile?.username, profile?.phone]);

  useEffect(() => {
    getAppConfig().then((c) => {
      setPricePerKm(parseFloat(c.price_per_km));
      setMinPrice(parseFloat(c.min_delivery_price));
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

  const deliveryFee = distanceKm != null && !Number.isNaN(distanceKm)
    ? Math.max(minPrice, distanceKm * pricePerKm)
    : null;
  const total = subtotal + (deliveryFee ?? 0);

  const runDistanceFromPoints = useCallback(
    async (
      bizLoc: { lat: number; lng: number },
      dest: { lat: number; lng: number }
    ) => {
      const km = await getOsrmDistanceKm(bizLoc, dest);
      if (km == null) {
        showAlert('Distância', 'Não foi possível calcular a rota. Informe a distância em km manualmente.');
        return false;
      }
      setDistanceKm(km);
      setManualKm(String(km));
      return true;
    },
    [showAlert]
  );

  const computeDistance = useCallback(async () => {
    if (!business) return;
    setCalcDist(true);
    setDistanceKm(null);
    try {
      const geoBiz = await geocodeAddress(businessGeoString(business));
      if (!geoBiz?.location) {
        showAlert('Endereço', 'Não foi possível localizar o restaurante. Tente mais tarde.');
        return;
      }

      if (destCoords) {
        const ok = await runDistanceFromPoints(geoBiz.location, destCoords);
        if (!ok) return;
        return;
      }

      const destStr = `${customerAddress}, ${customerNumber}, ${customerNeighborhood}, ${customerCity}, ${customerState}, ${customerCep}, Brasil`;
      const geoDest = await geocodeAddress(destStr);
      if (!geoDest?.location) {
        showAlert('Endereço', 'Não foi possível localizar o endereço de entrega. Confira os dados ou use a localização do aparelho.');
        return;
      }
      setDestCoords({ lat: geoDest.location.lat, lng: geoDest.location.lng });
      await runDistanceFromPoints(geoBiz.location, geoDest.location);
    } finally {
      setCalcDist(false);
    }
  }, [
    business,
    destCoords,
    customerAddress,
    customerNumber,
    customerNeighborhood,
    customerCity,
    customerState,
    customerCep,
    showAlert,
    runDistanceFromPoints,
  ]);

  const useMyLocation = useCallback(async () => {
    if (!business) return;
    if (Platform.OS === 'web') {
      showAlert('Localização', 'No navegador, informe o endereço de entrega manualmente.');
      return;
    }
    const perm = await requestLocationPermission();
    if (!perm.granted) {
      showAlert('Localização', perm.reason);
      return;
    }
    setLocLoading(true);
    setDistanceKm(null);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setDestCoords({ lat, lng });

      const rev = await reverseGeocode(lat, lng);
      if (rev) {
        fillingAddressRef.current = true;
        const p = geocodeResultToBrazilianParts(rev);
        setCustomerAddress(p.street);
        setCustomerNumber(p.number);
        setCustomerNeighborhood(p.neighborhood);
        setCustomerCity(p.city);
        setCustomerState(p.state);
        if (p.cep) setCustomerCep(p.cep);
        fillingAddressRef.current = false;
      } else {
        showAlert(
          'Endereço',
          'Coordenadas obtidas, mas não foi possível preencher o endereço automaticamente. Complete os campos e calcule a taxa.'
        );
      }

      setCalcDist(true);
      try {
        const geoBiz = await geocodeAddress(businessGeoString(business));
        if (!geoBiz?.location) {
          showAlert('Endereço', 'Não foi possível localizar o restaurante.');
          return;
        }
        await runDistanceFromPoints(geoBiz.location, { lat, lng });
      } finally {
        setCalcDist(false);
      }
    } catch (e) {
      console.warn('useMyLocation', e);
      showAlert('Localização', 'Não foi possível obter sua posição. Verifique se o GPS está ativo.');
      setDestCoords(null);
    } finally {
      setLocLoading(false);
    }
  }, [business, showAlert, runDistanceFromPoints]);

  const clearCoordsOnAddressEdit = useCallback(() => {
    if (fillingAddressRef.current) return;
    setDestCoords(null);
    setDistanceKm(null);
  }, []);

  const handleSubmit = async () => {
    if (!business || !userId || lines.length === 0) {
      showAlert('Erro', 'Dados incompletos.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      showAlert('Dados', 'Informe nome e telefone.');
      return;
    }
    if (!customerAddress.trim() || !customerNumber.trim() || !customerNeighborhood.trim() || !customerCity.trim() || !customerState.trim()) {
      showAlert('Endereço', 'Preencha o endereço de entrega completo.');
      return;
    }
    if (deliveryFee == null || distanceKm == null) {
      showAlert('Entrega', 'Calcule ou informe a distância para obter a taxa de entrega.');
      return;
    }

    const orderItems: OrderItemLine[] = lines.map((l) => ({
      product_id: l.productId,
      name: l.productName,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      notes: l.notes?.trim() || undefined,
    }));

    setSubmitting(true);
    const { data: created, error } = await createDelivery({
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
      delivery_lat: destCoords?.lat ?? null,
      delivery_lng: destCoords?.lng ?? null,
      distance_km: distanceKm,
      price: Math.round(total * 100) / 100,
      order_subtotal: Math.round(subtotal * 100) / 100,
      order_items: orderItems,
      order_source: 'app',
      customer_user_id: userId,
      notes: notes.trim() || `Pedido app — ${lines.length} item(ns)`,
      status: 'pending',
      payment_status: 'awaiting_payment',
    });
    setSubmitting(false);
    if (error || !created) {
      showAlert('Erro ao enviar', error ?? 'Falha ao criar pedido.');
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

  if (loadingBiz || !business) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 120, paddingTop: Spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.bizLabel}>Pedido em</Text>
        <Text style={styles.bizName}>{business.name}</Text>

        {!isBusinessOpenNow(business.opening_hours) ? (
          <View style={styles.closedBanner}>
            <MaterialIcons name="schedule" size={20} color={Colors.error} />
            <Text style={styles.closedBannerText}>
              Este restaurante parece estar fechado no horário atual. O pedido pode ser recusado ou atrasado.
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Seus dados</Text>
        <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Telefone (WhatsApp)" placeholderTextColor={Colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.section}>Endereço de entrega</Text>
        <Text style={styles.addressHint}>
          Use o GPS para gerar coordenadas e preencher o endereço automaticamente, ou digite o endereço completo.
        </Text>

        <TouchableOpacity
          style={[styles.locBtn, (locLoading || calcDist) && { opacity: 0.75 }]}
          onPress={useMyLocation}
          disabled={locLoading || calcDist}
          activeOpacity={0.88}
        >
          {locLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <MaterialIcons name="my-location" size={22} color={Colors.primary} />
              <Text style={styles.locBtnText}>Usar minha localização (GPS)</Text>
            </>
          )}
        </TouchableOpacity>

        {destCoords ? (
          <View style={styles.coordsPill}>
            <MaterialIcons name="place" size={16} color={Colors.success} />
            <Text style={styles.coordsPillText}>Local da entrega georreferenciado</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="CEP"
          placeholderTextColor={Colors.textMuted}
          value={customerCep}
          onChangeText={(t) => {
            clearCoordsOnAddressEdit();
            setCustomerCep(t);
          }}
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Rua / Avenida"
          placeholderTextColor={Colors.textMuted}
          value={customerAddress}
          onChangeText={(t) => {
            clearCoordsOnAddressEdit();
            setCustomerAddress(t);
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Número"
          placeholderTextColor={Colors.textMuted}
          value={customerNumber}
          onChangeText={(t) => {
            clearCoordsOnAddressEdit();
            setCustomerNumber(t);
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Complemento"
          placeholderTextColor={Colors.textMuted}
          value={customerComplement}
          onChangeText={setCustomerComplement}
        />
        <TextInput
          style={styles.input}
          placeholder="Bairro"
          placeholderTextColor={Colors.textMuted}
          value={customerNeighborhood}
          onChangeText={(t) => {
            clearCoordsOnAddressEdit();
            setCustomerNeighborhood(t);
          }}
        />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Cidade"
            placeholderTextColor={Colors.textMuted}
            value={customerCity}
            onChangeText={(t) => {
              clearCoordsOnAddressEdit();
              setCustomerCity(t);
            }}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="UF"
            placeholderTextColor={Colors.textMuted}
            value={customerState}
            onChangeText={(t) => {
              clearCoordsOnAddressEdit();
              setCustomerState(t.toUpperCase().slice(0, 2));
            }}
            maxLength={2}
          />
        </View>

        <TouchableOpacity style={styles.calcBtn} onPress={computeDistance} disabled={calcDist || locLoading} activeOpacity={0.88}>
          {calcDist ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <MaterialIcons name="route" size={20} color={Colors.white} />
              <Text style={styles.calcBtnText}>Calcular distância e taxa</Text>
            </>
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Ou informe a distância em km (manual)"
          placeholderTextColor={Colors.textMuted}
          value={manualKm}
          onChangeText={(t) => {
            setManualKm(t);
            const v = parseFloat(t.replace(',', '.'));
            if (!Number.isNaN(v) && v > 0) setDistanceKm(v);
          }}
          keyboardType="decimal-pad"
        />

        <TextInput style={[styles.input, { minHeight: 72 }]} placeholder="Observações do pedido" placeholderTextColor={Colors.textMuted} value={notes} onChangeText={setNotes} multiline />

        <View style={styles.summary}>
          <Row label="Subtotal (itens)" value={formatCurrency(subtotal)} />
          <Row label="Taxa de entrega" value={deliveryFee != null ? formatCurrency(deliveryFee) : '—'} />
          <Row label="Total" value={formatCurrency(total)} bold />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.9}
        >
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
  closedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.error + '18', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.error + '44',
  },
  closedBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  section: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
  addressHint: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 20 },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '66',
    paddingVertical: 14,
    marginBottom: Spacing.sm,
  },
  locBtnText: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.md },
  coordsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.success + '18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  coordsPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
  input: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.text, marginBottom: Spacing.sm, fontSize: FontSize.md,
  },
  calcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.info, height: 48, borderRadius: BorderRadius.md, marginBottom: Spacing.sm,
  },
  calcBtnText: { color: Colors.white, fontWeight: '800' },
  summary: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  submitBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.primary, height: 54, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
});
