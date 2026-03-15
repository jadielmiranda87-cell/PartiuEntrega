import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { NativeMapView as MapView, NativeMarker as Marker, NativePolyline as Polyline, NATIVE_PROVIDER_GOOGLE as PROVIDER_GOOGLE } from '@/components/ui/NativeMap';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { getDeliveryById, updateDeliveryStatus } from '@/services/deliveryService';
import { geocodeAddress, getDirections, decodePolyline, GeoLocation } from '@/services/mapsService';
import { Delivery } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp, formatCurrency, formatDate, formatPhone } from '@/utils/links';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 220;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando motoboy', color: Colors.warning },
  assigned: { label: 'Motoboy a caminho', color: Colors.info },
  collected: { label: 'Pedido coletado', color: Colors.primary },
  delivered: { label: 'Entregue', color: Colors.success },
  cancelled: { label: 'Cancelado', color: Colors.error },
};

interface RouteData {
  origin: GeoLocation;
  destination: GeoLocation;
  polyline: Array<{ latitude: number; longitude: number }>;
}

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const loadDelivery = useCallback(async () => {
    if (!id) return;
    const data = await getDeliveryById(id);
    setDelivery(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadDelivery(); }, [loadDelivery]);

  // Load map route after delivery data is available
  useEffect(() => {
    if (!delivery) return;
    const biz = (delivery as any).businesses;
    if (!biz) return;

    const loadRoute = async () => {
      setLoadingMap(true);
      try {
        const originAddr = [biz.address, biz.address_number, biz.neighborhood, biz.city, biz.state, 'Brasil'].filter(Boolean).join(', ');
        const destAddr = [
          delivery.customer_address, delivery.customer_address_number,
          delivery.customer_neighborhood, delivery.customer_city, delivery.customer_state, 'Brasil',
        ].filter(Boolean).join(', ');

        const directions = await getDirections(originAddr, destAddr);
        if (directions && directions.polyline) {
          setRouteData({
            origin: directions.start_location,
            destination: directions.end_location,
            polyline: decodePolyline(directions.polyline),
          });
        } else {
          // Fallback: just geocode the two points
          const [orig, dest] = await Promise.all([
            geocodeAddress(originAddr),
            geocodeAddress(destAddr),
          ]);
          if (orig && dest) {
            setRouteData({ origin: orig.location, destination: dest.location, polyline: [] });
          }
        }
      } catch {
        // Map is optional, ignore errors
      } finally {
        setLoadingMap(false);
      }
    };

    loadRoute();
  }, [delivery]);

  const handleCancel = () => {
    if (!delivery || delivery.status !== 'pending') return;
    showAlert('Cancelar entrega?', 'Esta ação não pode ser desfeita.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar entrega', style: 'destructive', onPress: async () => {
          setCancelling(true);
          await updateDeliveryStatus(delivery.id, 'cancelled');
          setCancelling(false);
          router.back();
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

  // Map region: center between origin and destination
  const mapRegion = routeData ? {
    latitude: (routeData.origin.lat + routeData.destination.lat) / 2,
    longitude: (routeData.origin.lng + routeData.destination.lng) / 2,
    latitudeDelta: Math.abs(routeData.origin.lat - routeData.destination.lat) * 1.6 + 0.01,
    longitudeDelta: Math.abs(routeData.origin.lng - routeData.destination.lng) * 1.6 + 0.01,
  } : undefined;

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

        {/* ── Map ── */}
        <View style={styles.mapContainer}>
          {loadingMap ? (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.mapLoadingText}>Carregando mapa...</Text>
            </View>
          ) : routeData ? (
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={mapRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              customMapStyle={darkMapStyle}
            >
              {/* Origin marker (business) */}
              <Marker
                coordinate={{ latitude: routeData.origin.lat, longitude: routeData.origin.lng }}
                title="Comércio"
                pinColor={Colors.primary}
              />

              {/* Destination marker (customer) */}
              <Marker
                coordinate={{ latitude: routeData.destination.lat, longitude: routeData.destination.lng }}
                title={delivery.customer_name}
                pinColor={Colors.error}
              />

              {/* Route polyline */}
              {routeData.polyline.length > 0 && (
                <Polyline
                  coordinates={routeData.polyline}
                  strokeColor={Colors.primary}
                  strokeWidth={3}
                />
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <MaterialIcons name="map" size={32} color={Colors.textMuted} />
              <Text style={styles.mapLoadingText}>Mapa indisponível</Text>
            </View>
          )}

          {/* Legend overlay */}
          {routeData && (
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>Comércio</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                <Text style={styles.legendText}>Cliente</Text>
              </View>
            </View>
          )}
        </View>

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

          {delivery.status === 'pending' && (
            <TouchableOpacity
              style={[styles.cancelBtn, cancelling && styles.btnDisabled]}
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

// Google Maps dark style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8aaa' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373750' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0d1a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.md },

  // Map
  mapContainer: { width, height: MAP_HEIGHT, backgroundColor: Colors.surfaceElevated, marginBottom: Spacing.md },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapLoadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  mapLegend: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: Colors.surface + 'CC',
    borderRadius: BorderRadius.sm, padding: 8, gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FontSize.xs, color: Colors.text },

  statusCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 6, marginBottom: Spacing.sm },
  statusText: { fontWeight: '700', fontSize: FontSize.sm },
  priceValue: { fontSize: 36, fontWeight: '800', color: Colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  metaSep: { color: Colors.textMuted },

  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
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
  cancelBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  btnDisabled: { opacity: 0.6 },
  cancelBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.md },
});
