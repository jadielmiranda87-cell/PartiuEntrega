import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeMapView, NativeMarker, NativePolyline } from '@/components/ui/NativeMap';
import { getDirections, decodePolyline, type GeoLocation } from '@/services/mapsService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

type Status = 'pending' | 'assigned' | 'collected' | 'delivered' | 'cancelled' | string;

function toLatLng(g: GeoLocation) {
  return { latitude: g.lat, longitude: g.lng };
}

function regionFromPoints(points: { latitude: number; longitude: number }[]) {
  if (points.length === 0) {
    return {
      latitude: -15.78,
      longitude: -47.93,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const pad = 1.5;
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: Math.max((maxLat - minLat) * pad, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * pad, 0.02),
  };
}

type Props = {
  status: Status;
  businessCoord: GeoLocation | null;
  customerCoord: GeoLocation | null;
  motoboyLat?: number | null;
  motoboyLng?: number | null;
  /** 4 últimos dígitos do celular do cliente (definidos na coleta); fixo sobre o mapa. */
  handoffCode?: string | null;
};

/**
 * Cliente acompanha o entregador no mapa desde o aceite até a entrega.
 * Rota: entregador → comércio (assigned) ou entregador → cliente (collected).
 */
export function CustomerDeliveryTrackingMap({
  status,
  businessCoord,
  customerCoord,
  motoboyLat,
  motoboyLng,
  handoffCode,
}: Props) {
  const [polyline, setPolyline] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  const motoboyCoord: GeoLocation | null =
    motoboyLat != null && motoboyLng != null && Number.isFinite(motoboyLat) && Number.isFinite(motoboyLng)
      ? { lat: motoboyLat, lng: motoboyLng }
      : null;

  const routeDestination = useMemo(() => {
    if (status === 'assigned') return businessCoord;
    if (status === 'collected') return customerCoord;
    return null;
  }, [status, businessCoord, customerCoord]);

  const loadRoute = useCallback(async () => {
    if (!motoboyCoord || !routeDestination) {
      setPolyline([]);
      return;
    }
    setRouteLoading(true);
    try {
      const dir = await getDirections(motoboyCoord, routeDestination);
      if (dir?.polyline) {
        setPolyline(decodePolyline(dir.polyline));
      } else {
        setPolyline([toLatLng(motoboyCoord), toLatLng(routeDestination)]);
      }
    } catch {
      setPolyline(
        motoboyCoord && routeDestination ? [toLatLng(motoboyCoord), toLatLng(routeDestination)] : []
      );
    } finally {
      setRouteLoading(false);
    }
  }, [motoboyCoord, routeDestination]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  const region = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = [];
    if (motoboyCoord) pts.push(toLatLng(motoboyCoord));
    if (routeDestination) pts.push(toLatLng(routeDestination));
    if (status === 'assigned' && customerCoord) pts.push(toLatLng(customerCoord));
    if (status === 'collected' && businessCoord) pts.push(toLatLng(businessCoord));
    return regionFromPoints(pts.length > 0 ? pts : polyline);
  }, [motoboyCoord, routeDestination, customerCoord, businessCoord, status, polyline]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webBox}>
        <MaterialIcons name="map" size={28} color={Colors.textMuted} />
        <Text style={styles.webText}>Acompanhe a entrega no app Android ou iOS</Text>
        {handoffCode ? (
          <View style={styles.handoffWeb}>
            <Text style={styles.handoffWebLabel}>Seu código para receber o pedido</Text>
            <Text style={styles.handoffWebDigits}>{handoffCode}</Text>
            <Text style={styles.handoffWebHint}>Informe ao entregador ao receber. Só aparece aqui no app.</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (status !== 'assigned' && status !== 'collected') {
    return null;
  }

  const title =
    status === 'assigned' ? 'Entregador a caminho do restaurante' : 'Entregador a caminho do seu endereço';

  return (
    <View style={styles.wrap}>
      <View style={styles.banner}>
        <MaterialIcons name="delivery-dining" size={20} color={Colors.primary} />
        <Text style={styles.bannerTitle}>{title}</Text>
      </View>
      <View style={styles.mapBox}>
        {routeLoading && polyline.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : null}
        <NativeMapView style={StyleSheet.absoluteFill} region={region} key={`${status}-${motoboyLat}-${motoboyLng}`}>
          {polyline.length > 1 ? (
            <NativePolyline coordinates={polyline} strokeColor={Colors.primary} strokeWidth={4} />
          ) : null}
          {businessCoord ? (
            <NativeMarker
              coordinate={toLatLng(businessCoord)}
              title="Restaurante"
              pinColor="#FF6B00"
              tracksViewChanges={false}
            />
          ) : null}
          {customerCoord && status !== 'assigned' ? (
            <NativeMarker
              coordinate={toLatLng(customerCoord)}
              title="Seu endereço"
              pinColor="#22C55E"
              tracksViewChanges={false}
            />
          ) : null}
          {motoboyCoord ? (
            <NativeMarker
              coordinate={toLatLng(motoboyCoord)}
              title="Entregador"
              pinColor="#3B82F6"
              tracksViewChanges={false}
            />
          ) : null}
        </NativeMapView>
        {!motoboyCoord ? (
          <View style={styles.hintOverlay}>
            <View style={styles.hintPill}>
              <Text style={styles.hintText}>Aguardando posição do entregador…</Text>
            </View>
          </View>
        ) : null}
        {handoffCode && status === 'collected' ? (
          <View style={styles.handoffOverlay} pointerEvents="box-none">
            <View style={styles.handoffCard}>
              <Text style={styles.handoffLabel}>Código para receber</Text>
              <Text style={styles.handoffDigits}>{handoffCode}</Text>
              <Text style={styles.handoffSub}>Últimos 4 dígitos do seu celular. Informe ao entregador. Não enviamos por WhatsApp.</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  bannerTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text, flex: 1 },
  mapBox: { height: 240, backgroundColor: Colors.surfaceElevated, position: 'relative' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2, backgroundColor: '#0004' },
  hintOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    zIndex: 3,
  },
  hintPill: {
    backgroundColor: Colors.background + 'EE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintText: { fontSize: FontSize.xs, color: Colors.text },
  handoffOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 8,
    zIndex: 4,
  },
  handoffCard: {
    backgroundColor: Colors.background + 'F5',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  handoffLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  handoffDigits: { fontSize: 36, fontWeight: '900', color: Colors.text, letterSpacing: 10, marginTop: 4 },
  handoffSub: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  handoffWeb: {
    marginTop: Spacing.md,
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.secondary,
    width: '100%',
  },
  handoffWebLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  handoffWebDigits: { fontSize: 32, fontWeight: '900', letterSpacing: 8, color: Colors.text, marginVertical: 6 },
  handoffWebHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  webBox: {
    padding: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  webText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
});
