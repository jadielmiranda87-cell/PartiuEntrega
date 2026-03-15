import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import { createDelivery } from '@/services/deliveryService';
import { getAppConfig } from '@/services/configService';
import { searchCustomers, upsertCustomer, Customer } from '@/services/customerService';
import {
  getAddressSuggestions, geocodeAddress, getDirections,
  PlacePrediction,
} from '@/services/mapsService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';

// ─── Fallback: OSRM road distance ────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getOsrmDistanceKm(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'MotoLinkApp/1.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) return null;
    return Math.round((json.routes[0].distance / 1000) * 10) / 10;
  } catch {
    return null;
  }
}

// ─── Input helper ─────────────────────────────────────────────────────────────

function InputField({
  label, required, style: styleProp, ...props
}: { label: string; required?: boolean; style?: object } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput style={[styles.input, styleProp]} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NewDeliveryScreen() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCep, setCustomerCep] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [customerComplement, setCustomerComplement] = useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [notes, setNotes] = useState('');

  // Address search (Google Places)
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<PlacePrediction[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const sessionToken = useRef(`sess_${Date.now()}`);

  // Customer autocomplete
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Distance
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceInput, setDistanceInput] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [geoError, setGeoError] = useState(false);

  const [pricePerKm, setPricePerKm] = useState(2.5);
  const [minPrice, setMinPrice] = useState(8.0);
  const [loading, setLoading] = useState(false);

  const { businessProfile, loading: authLoading } = useAppAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const distanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAppConfig().then((c) => {
      setPricePerKm(parseFloat(c.price_per_km));
      setMinPrice(parseFloat(c.min_delivery_price));
    });
  }, []);

  // ── Google Places address search ──────────────────────────────────────────

  const handleAddressSearchChange = (text: string) => {
    setAddressSearch(text);
    setAddressSelected(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    setSearchingAddress(true);
    searchTimer.current = setTimeout(async () => {
      const results = await getAddressSuggestions(text, sessionToken.current);
      setAddressSuggestions(results);
      setShowAddressSuggestions(results.length > 0);
      setSearchingAddress(false);
    }, 400);
  };

  const handleAddressSelect = async (prediction: PlacePrediction) => {
    setShowAddressSuggestions(false);
    setAddressSearch(prediction.structured_formatting?.main_text ?? prediction.description);
    setSearchingAddress(true);

    const geo = await geocodeAddress(undefined, prediction.place_id);
    setSearchingAddress(false);

    if (!geo) {
      showAlert('Erro', 'Não foi possível obter detalhes do endereço. Preencha manualmente.');
      return;
    }

    // Parse address components
    const comps = geo.address_components ?? [];
    const get = (type: string) =>
      comps.find((c) => c.types.includes(type))?.long_name ?? '';
    const getShort = (type: string) =>
      comps.find((c) => c.types.includes(type))?.short_name ?? '';

    const street = get('route') || get('street_address');
    const number = get('street_number');
    const neighborhood = get('sublocality_level_1') || get('sublocality') || get('neighborhood');
    const city = get('administrative_area_level_2') || get('locality');
    const state = getShort('administrative_area_level_1');
    const postal = get('postal_code').replace('-', '');

    setCustomerAddress(street);
    setCustomerNumber(number);
    setCustomerNeighborhood(neighborhood);
    setCustomerCity(city);
    setCustomerState(state);
    setCustomerCep(postal);
    setAddressSelected(true);

    // Renew session token after place details request
    sessionToken.current = `sess_${Date.now()}`;

    // Trigger distance calculation
    if (street && city && state && businessProfile) {
      calculateDistanceFor(street, number, neighborhood, city, state);
    }
  };

  // ── Customer search autocomplete ──────────────────────────────────────────

  const handleNameChange = (text: string) => {
    setCustomerName(text);
    triggerCustomerSearch(text);
  };

  const handlePhoneChange = (text: string) => {
    setCustomerPhone(text);
    triggerCustomerSearch(text);
  };

  const triggerCustomerSearch = (query: string) => {
    if (!businessProfile) return;
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    customerSearchTimer.current = setTimeout(async () => {
      const results = await searchCustomers(businessProfile.id, query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setLoadingSuggestions(false);
    }, 400);
  };

  const fillFromCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address);
    setCustomerNumber(customer.address_number);
    setCustomerComplement(customer.complement);
    setCustomerNeighborhood(customer.neighborhood);
    setCustomerCity(customer.city);
    setCustomerState(customer.state);
    setCustomerCep(customer.cep);
    setAddressSearch([customer.address, customer.address_number, customer.city].filter(Boolean).join(', '));
    setAddressSelected(true);
    setSuggestions([]);
    setShowSuggestions(false);
    // Trigger distance
    if (customer.address && customer.city && customer.state && businessProfile) {
      calculateDistanceFor(customer.address, customer.address_number, customer.neighborhood, customer.city, customer.state);
    }
  };

  // ── Distance calculation via Google Directions (fallback: OSRM) ───────────

  const calculateDistanceFor = useCallback(async (
    addr: string, num: string, neigh: string, city: string, state: string
  ) => {
    if (!businessProfile) return;
    setCalculatingDistance(true);
    setDistanceKm(null);
    setGeoError(false);
    setManualMode(false);

    try {
      const originStr = [
        businessProfile.address, businessProfile.address_number,
        businessProfile.neighborhood, businessProfile.city, businessProfile.state, 'Brasil',
      ].filter(Boolean).join(', ');

      const destStr = [addr, num, neigh, city, state, 'Brasil'].filter(Boolean).join(', ');

      // Try Google Directions first
      const directions = await getDirections(originStr, destStr);
      if (directions?.distance?.value) {
        const km = Math.round((directions.distance.value / 1000) * 10) / 10;
        setDistanceKm(km);
        setDistanceInput(String(km));
        return;
      }

      // Fallback: geocode both addresses via Google, then OSRM
      const [originGeo, destGeo] = await Promise.all([
        geocodeAddress(originStr),
        geocodeAddress(destStr),
      ]);
      if (originGeo && destGeo) {
        const km = await getOsrmDistanceKm(
          { lat: originGeo.location.lat, lng: originGeo.location.lng },
          { lat: destGeo.location.lat, lng: destGeo.location.lng }
        );
        if (km !== null) {
          setDistanceKm(km);
          setDistanceInput(String(km));
          return;
        }
      }

      setGeoError(true);
    } catch {
      setGeoError(true);
    } finally {
      setCalculatingDistance(false);
    }
  }, [businessProfile]);

  // Re-calculate when manual fields change (if address wasn't selected via Places)
  useEffect(() => {
    if (addressSelected) return;
    const ready = !!(customerAddress && customerCity && customerState);
    if (!ready) { setDistanceKm(null); setGeoError(false); return; }
    if (distanceTimer.current) clearTimeout(distanceTimer.current);
    distanceTimer.current = setTimeout(() => {
      calculateDistanceFor(customerAddress, customerNumber, customerNeighborhood, customerCity, customerState);
    }, 1200);
    return () => { if (distanceTimer.current) clearTimeout(distanceTimer.current); };
  }, [customerAddress, customerNumber, customerNeighborhood, customerCity, customerState, addressSelected, calculateDistanceFor]);

  const effectiveKm = manualMode
    ? (parseFloat(distanceInput.replace(',', '.')) || null)
    : distanceKm;

  const estimatedPrice = () => {
    if (effectiveKm === null) return null;
    return Math.max(minPrice, effectiveKm * pricePerKm);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!customerName || !customerPhone || !customerAddress || !customerNumber || !customerNeighborhood || !customerCity || !customerState) {
      showAlert('Campos obrigatórios', 'Preencha nome, telefone e endereço completo do cliente.');
      return;
    }
    if (effectiveKm === null || isNaN(effectiveKm) || effectiveKm <= 0) {
      showAlert('Distância não calculada', 'Informe a distância manualmente ou verifique o endereço.');
      return;
    }
    if (!businessProfile) {
      showAlert('Erro', 'Perfil do comércio não encontrado. Tente sair e entrar novamente.');
      return;
    }
    setLoading(true);
    const price = estimatedPrice()!;

    if (customerPhone.trim()) {
      await upsertCustomer(businessProfile.id, {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        address_number: customerNumber,
        complement: customerComplement,
        neighborhood: customerNeighborhood,
        city: customerCity,
        state: customerState,
        cep: customerCep,
      });
    }

    const { error } = await createDelivery({
      business_id: businessProfile.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_address_number: customerNumber,
      customer_complement: customerComplement,
      customer_neighborhood: customerNeighborhood,
      customer_city: customerCity,
      customer_state: customerState,
      customer_cep: customerCep,
      distance_km: effectiveKm!,
      price,
      notes,
    });
    setLoading(false);
    if (error) { showAlert('Erro ao criar entrega', error); return; }
    showAlert('Entrega criada!', 'Aguardando motoboy disponível.', [{ text: 'OK', onPress: resetForm }]);
  };

  const resetForm = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerCep('');
    setCustomerAddress(''); setCustomerNumber(''); setCustomerComplement('');
    setCustomerNeighborhood(''); setCustomerCity(''); setCustomerState('');
    setAddressSearch(''); setAddressSelected(false);
    setDistanceKm(null); setDistanceInput(''); setManualMode(false); setNotes('');
    setSuggestions([]); setShowSuggestions(false);
    sessionToken.current = `sess_${Date.now()}`;
  };

  const price = estimatedPrice();
  const canSubmit = !loading && !calculatingDistance && effectiveKm !== null && effectiveKm > 0;

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Nova Entrega</Text>

        {businessProfile && (
          <View style={styles.originCard}>
            <MaterialIcons name="store" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.originLabel}>Origem (seu endereço)</Text>
              <Text style={styles.originAddress}>
                {businessProfile.address}, {businessProfile.address_number} — {businessProfile.neighborhood}, {businessProfile.city}
              </Text>
            </View>
          </View>
        )}

        {/* ── Cliente ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>

          {/* Name with autocomplete */}
          <View style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.label}>Nome do cliente *</Text>
            <View style={{ position: 'relative' }}>
              <View style={styles.searchInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, borderColor: showSuggestions ? Colors.primary : Colors.border }]}
                  value={customerName}
                  onChangeText={handleNameChange}
                  placeholder="Nome completo ou buscar cliente salvo"
                  placeholderTextColor={Colors.textMuted}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                />
                {loadingSuggestions && (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ position: 'absolute', right: 14 }} />
                )}
              </View>

              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.dropdown}>
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => fillFromCustomer(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.suggestionIcon}>
                          <MaterialIcons name="person" size={16} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionName}>{item.name}</Text>
                          <Text style={styles.suggestionSub}>{item.phone}{item.city ? ` · ${item.city}` : ''}</Text>
                        </View>
                        <MaterialIcons name="north-west" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
                  />
                  <TouchableOpacity
                    onPress={() => setShowSuggestions(false)}
                    style={styles.closeSuggestions}
                  >
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.label}>Telefone / WhatsApp *</Text>
            <TextInput
              style={styles.input}
              value={customerPhone}
              onChangeText={handlePhoneChange}
              placeholder="(11) 99999-9999"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* ── Endereço ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço de Entrega</Text>

          {/* Google Places address search */}
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={styles.label}>Buscar endereço</Text>
            <View style={{ position: 'relative' }}>
              <View style={[styles.searchInputRow, { alignItems: 'center' }]}>
                <MaterialIcons name="search" size={20} color={Colors.textMuted} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, paddingLeft: 40, borderColor: showAddressSuggestions ? Colors.primary : Colors.border },
                    addressSelected && { borderColor: Colors.success },
                  ]}
                  value={addressSearch}
                  onChangeText={handleAddressSearchChange}
                  placeholder="Digite o endereço do cliente..."
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="search"
                />
                {searchingAddress ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ position: 'absolute', right: 14 }} />
                ) : addressSelected ? (
                  <MaterialIcons name="check-circle" size={20} color={Colors.success} style={{ position: 'absolute', right: 14 }} />
                ) : null}
              </View>

              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <View style={[styles.dropdown, { zIndex: 1000 }]}>
                  <FlatList
                    data={addressSuggestions}
                    keyExtractor={(item) => item.place_id}
                    scrollEnabled={false}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => handleAddressSelect(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.suggestionIcon, { backgroundColor: Colors.info + '22' }]}>
                          <MaterialIcons name="location-on" size={16} color={Colors.info} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionName} numberOfLines={1}>
                            {item.structured_formatting?.main_text ?? item.description}
                          </Text>
                          <Text style={styles.suggestionSub} numberOfLines={1}>
                            {item.structured_formatting?.secondary_text ?? ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
                  />
                  <TouchableOpacity onPress={() => setShowAddressSuggestions(false)} style={styles.closeSuggestions}>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 }}>
              Selecione o endereço sugerido ou preencha os campos abaixo manualmente
            </Text>
          </View>

          <InputField label="CEP" value={customerCep} onChangeText={setCustomerCep} placeholder="00000-000" keyboardType="numeric" />
          <InputField label="Endereço" required value={customerAddress} onChangeText={(t) => { setCustomerAddress(t); setAddressSelected(false); }} placeholder="Rua, Avenida..." />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <InputField label="Número" required value={customerNumber} onChangeText={setCustomerNumber} placeholder="123" keyboardType="numeric" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 2 }}>
              <InputField label="Complemento" value={customerComplement} onChangeText={setCustomerComplement} placeholder="Apto, Sala..." />
            </View>
          </View>
          <InputField label="Bairro" required value={customerNeighborhood} onChangeText={setCustomerNeighborhood} placeholder="Bairro" />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 2 }}>
              <InputField label="Cidade" required value={customerCity} onChangeText={(t) => { setCustomerCity(t); setAddressSelected(false); }} placeholder="Cidade" />
            </View>
            <View style={{ width: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <InputField label="UF" required value={customerState} onChangeText={(t) => { setCustomerState(t); setAddressSelected(false); }} placeholder="SP" autoCapitalize="characters" maxLength={2} />
            </View>
          </View>
        </View>

        {/* ── Distância ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cálculo de Distância</Text>
          <Text style={[styles.label, { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm }]}>
            Calculada automaticamente via Google Maps
          </Text>

          <View style={styles.distanceRow}>
            <View style={styles.distanceField}>
              <Text style={styles.label}>Distância (km)</Text>
              {manualMode ? (
                <TextInput
                  style={[styles.input, { borderColor: Colors.warning }]}
                  value={distanceInput}
                  onChangeText={setDistanceInput}
                  placeholder="Ex: 5.2"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              ) : (
                <View style={[styles.distanceValue, calculatingDistance && styles.distanceValueLoading]}>
                  {calculatingDistance ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.distanceCalculatingText}>Calculando rota...</Text>
                    </View>
                  ) : distanceKm !== null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="straighten" size={18} color={Colors.primary} />
                      <Text style={styles.distanceKmText}>{distanceKm} km</Text>
                    </View>
                  ) : geoError ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                      <Text style={[styles.distancePlaceholder, { color: Colors.error }]}>Erro — use o modo manual</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="gps-not-fixed" size={16} color={Colors.textMuted} />
                      <Text style={styles.distancePlaceholder}>Busque o endereço acima</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={{ gap: 4 }}>
              {!manualMode && (customerAddress && customerCity && customerState) && (
                <TouchableOpacity
                  style={styles.recalcBtn}
                  onPress={() => calculateDistanceFor(customerAddress, customerNumber, customerNeighborhood, customerCity, customerState)}
                  disabled={calculatingDistance}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="refresh" size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.recalcBtn, manualMode && { borderColor: Colors.warning }]}
                onPress={() => setManualMode((m) => !m)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name={manualMode ? 'gps-fixed' : 'edit'} size={18} color={manualMode ? Colors.warning : Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {manualMode && (
            <Text style={{ fontSize: FontSize.xs, color: Colors.warning, marginBottom: Spacing.sm }}>
              Modo manual — digite a distância em km.
            </Text>
          )}

          {price !== null ? (
            <View style={styles.priceEstimate}>
              <MaterialIcons name="attach-money" size={20} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.priceEstimateLabel}>Valor da entrega</Text>
                <Text style={styles.priceEstimateSub}>{formatCurrency(pricePerKm)}/km • mínimo {formatCurrency(minPrice)}</Text>
              </View>
              <Text style={styles.priceEstimateValue}>{formatCurrency(price)}</Text>
            </View>
          ) : null}

          <InputField
            label="Observações"
            value={notes}
            onChangeText={setNotes}
            placeholder="Informações adicionais..."
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />
        </View>

        <TouchableOpacity
          style={[styles.createBtn, !canSubmit && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="send" size={20} color={Colors.white} />
              <Text style={styles.createBtnText}>Solicitar Entrega</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  originCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  originLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  originAddress: { fontSize: FontSize.sm, color: Colors.text, marginTop: 2 },
  section: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 48, color: Colors.text,
    fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border,
  },
  searchInputRow: { flexDirection: 'row', alignItems: 'center' },
  dropdown: {
    position: 'absolute', top: 50, left: 0, right: 0, zIndex: 999,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.primary + '66',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  suggestionIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  suggestionSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  closeSuggestions: {
    paddingVertical: 8, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  distanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginBottom: Spacing.sm },
  distanceField: { flex: 1 },
  distanceValue: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 48,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center',
  },
  distanceValueLoading: { borderColor: Colors.primary + '66' },
  distanceKmText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  distanceCalculatingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  distancePlaceholder: { fontSize: FontSize.sm, color: Colors.textMuted },
  recalcBtn: {
    width: 48, height: 48, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  priceEstimate: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#1a2a1a', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.success,
  },
  priceEstimateLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  priceEstimateValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.success },
  priceEstimateSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  createBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    height: 54, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  createBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
