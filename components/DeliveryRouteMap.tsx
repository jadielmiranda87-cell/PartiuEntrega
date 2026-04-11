import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeMapView, NativeMarker, NativePolyline } from '@/components/ui/NativeMap';
import { getDirections, decodePolyline, type GeoLocation } from '@/services/mapsService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { openGoogleMapsToDestination } from '@/utils/links';

type Phase = 'pickup' | 'dropoff';

function toLatLng(g: GeoLocation) {
  return { latitude: g.lat, longitude: g.lng };
}

function regionFromPoints(points: { latitude: number; longitude: number }[]) {
  if (points.length === 0) {
    return {
      latitude: -15.78,
      longitude: -47.93,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
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
  const pad = 1.45;
  const latD = Math.max((maxLat - minLat) * pad, 0.015);
  const lngD = Math.max((maxLng - minLng) * pad, 0.015);
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latD,
    longitudeDelta: lngD,
  };
}

function straightLine(a: GeoLocation, b: GeoLocation) {
  return [toLatLng(a), toLatLng(b)];
}

type Props = {
  phase: Phase;
  businessCoord: GeoLocation | null;
  customerCoord: GeoLocation | null;
  mapHeight?: number;
};

/**
 * Mapa com rota estilo app de entrega: na coleta mostra caminho até o comércio;
 * após coleta, caminho até o cliente. Usa GPS do motoboy + Directions (Edge).
 */
export function DeliveryRouteMap({ phase, businessCoord, customerCoord, mapHeight = 280 }: Props) {
  const [userCoord, setUserCoord] = useState<GeoLocation | null>(null);
  const [polyline, setPolyline] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeMeta, setRouteMeta] = useState<{ distance?: string; duration?: string }>({});
  const [loading, setLoading] = useState(true);
  const [permDenied, setPermDenied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const destination = phase === 'pickup' ? businessCoord : customerCoord;
  const destRef = useRef(destination);
  useEffect(() => {
    destRef.current = destination;
  }, [destination]);

  const loadRoute = useCallback(
    async (from: GeoLocation | null, dest: GeoLocation | null) => {
      if (!dest) {
        setPolyline([]);
        setRouteMeta({});
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const origin = from ?? dest;
        const dir = await getDirections(origin, dest);
        if (dir?.polyline) {
          const pts = decodePolyline(dir.polyline);
          setPolyline(pts);
          setRouteMeta({
            distance: dir.distance?.text,
            duration: dir.duration?.text,
          });
        } else if (from) {
          setPolyline(straightLine(from, dest));
          setRouteMeta({});
        } else {
          setPolyline([toLatLng(dest)]);
          setRouteMeta({});
        }
      } catch {
        if (from && dest) setPolyline(straightLine(from, dest));
        else if (dest) setPolyline([toLatLng(dest)]);
        setRouteMeta({});
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) {
          setPermDenied(true);
          await loadRoute(null, destination);
        }
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      const u: GeoLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserCoord(u);
      await loadRoute(u, destination);
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 80,
          timeInterval: 20000,
        },
        (loc) => {
          const next: GeoLocation = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setUserCoord(next);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            void loadRoute(next, destRef.current);
          }, 900);
        }
      );
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [destination?.lat, destination?.lng, phase, loadRoute]);

  const region = useMemo(() => {
    const pts = [...polyline];
    if (userCoord) pts.push(toLatLng(userCoord));
    if (destination) pts.push(toLatLng(destination));
    return regionFromPoints(pts);
  }, [polyline, userCoord, destination]);

  const title = phase === 'pickup' ? 'Rota até o comércio' : 'Rota até o cliente';

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webFallback, { height: mapHeight }]}>
        <MaterialIcons name="map" size={32} color={Colors.textMuted} />
        <Text style={styles.webFallbackText}>Mapa disponível no app (Android/iOS)</Text>
      </View>
    );
  }

  if (!businessCoord && !customerCoord) {
    return null;
  }

  return (
    <View style={[styles.wrap, { height: mapHeight }]}>
      <View style={styles.mapBanner}>
        <MaterialIcons name="navigation" size={18} color={Colors.primary} />
        <Text style={styles.mapBannerTitle}>{title}</Text>
        {routeMeta.duration ? (
          <Text style={styles.mapBannerMeta}>
            {routeMeta.duration}
            {routeMeta.distance ? ` · ${routeMeta.distance}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.mapBox}>
        {loading && polyline.length === 0 ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}
        <NativeMapView style={StyleSheet.absoluteFill} region={region} key={`${phase}-${destination?.lat}-${destination?.lng}`}>
          {polyline.length > 1 ? (
            <NativePolyline
              coordinates={polyline}
              strokeColor={Colors.primary}
              strokeWidth={5}
            />
          ) : null}
          {businessCoord ? (
            <NativeMarker
              coordinate={toLatLng(businessCoord)}
              title="Comércio"
              description="Retirada do pedido"
              pinColor="#FF6B00"
              tracksViewChanges={false}
            />
          ) : null}
          {customerCoord ? (
            <NativeMarker
              coordinate={toLatLng(customerCoord)}
              title="Cliente"
              description="Entrega"
              pinColor="#22C55E"
              tracksViewChanges={false}
            />
          ) : null}
          {userCoord ? (
            <NativeMarker
              coordinate={toLatLng(userCoord)}
              title="Você"
              pinColor="#3B82F6"
              tracksViewChanges={false}
            />
          ) : null}
        </NativeMapView>
      </View>

      {destination ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.gmapsBtn}
            onPress={() => openGoogleMapsToDestination({ lat: destination.lat, lng: destination.lng }, userCoord ?? undefined)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="map" size={18} color={Colors.white} />
            <Text style={styles.gmapsBtnText}>Google Maps</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {permDenied ? (
        <Text style={styles.hint}>
          Ative a localização para ver a rota em tempo real. Use o botão do mapa externo para navegar.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md, overflow: 'hidden', borderRadius: BorderRadius.lg },
  mapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  mapBannerTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text, flex: 1 },
  mapBannerMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, width: '100%', marginLeft: 26 },
  mapBox: {
    height: 220,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    backgroundColor: Colors.surfaceElevated,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: Colors.background + '99',
  },
  actionsRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  gmapsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    height: 44,
    borderRadius: BorderRadius.md,
  },
  gmapsBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.sm },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  webFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  webFallbackText: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
