import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reverseGeocode } from '@/services/mapsService';
import { requestLocationPermission } from '@/services/permissionsService';
import { commitCheckoutMapPickerResult } from '@/services/checkoutMapPickerResult';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useAlert } from '@/template';

type LatLng = { latitude: number; longitude: number };

const DEFAULT_CENTER: LatLng = { latitude: -16.821, longitude: -49.244 }; // Aparecida de Goiânia ~

function getAndroidGoogleMapsKey(): string {
  const ex = Constants.expoConfig as Record<string, unknown> | null | undefined;
  const android = ex?.android as Record<string, unknown> | undefined;
  const config = android?.config as Record<string, unknown> | undefined;
  const gm = config?.googleMaps as Record<string, unknown> | undefined;
  const fromManifest = typeof gm?.apiKey === 'string' ? gm.apiKey : '';
  const extra = ex?.extra as Record<string, unknown> | undefined;
  const fromExtra = typeof extra?.googleMapsApiKey === 'string' ? extra.googleMapsApiKey : '';
  return fromManifest || fromExtra || '';
}

export default function DeliveryMapPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const { showAlert } = useAlert();

  const [coord, setCoord] = useState<LatLng>(DEFAULT_CENTER);
  const [mapReady, setMapReady] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const mapModule = useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      const m = require('react-native-maps');
      return {
        MapView: m.default as React.ComponentType<any>,
        Marker: m.Marker as React.ComponentType<any>,
        PROVIDER_GOOGLE: m.PROVIDER_GOOGLE as string | undefined,
      };
    } catch {
      return null;
    }
  }, []);

  const refreshPreview = useCallback(async (lat: number, lng: number) => {
    setPreviewLoading(true);
    try {
      const g = await reverseGeocode(lat, lng);
      setPreview(g?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const la = params.lat ? parseFloat(String(params.lat)) : NaN;
      const ln = params.lng ? parseFloat(String(params.lng)) : NaN;
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        if (!cancelled) {
          setCoord({ latitude: la, longitude: ln });
          setInitDone(true);
        }
        return;
      }
      const perm = await requestLocationPermission();
      if (!perm.granted) {
        if (!cancelled) {
          showAlert('Localização', perm.reason);
          setInitDone(true);
        }
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) {
          setCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        if (!cancelled) showAlert('GPS', 'Não foi possível obter sua posição. Aproxime o mapa manualmente.');
      } finally {
        if (!cancelled) setInitDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.lat, params.lng, showAlert]);

  useEffect(() => {
    if (!initDone) return;
    refreshPreview(coord.latitude, coord.longitude);
  }, [initDone, coord.latitude, coord.longitude, refreshPreview]);

  const onDragEnd = useCallback((e: { nativeEvent: { coordinate: LatLng } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCoord({ latitude, longitude });
  }, []);

  const onConfirm = async () => {
    setConfirmLoading(true);
    try {
      const g = await reverseGeocode(coord.latitude, coord.longitude);
      commitCheckoutMapPickerResult({
        lat: coord.latitude,
        lng: coord.longitude,
        geocode: g,
      });
      router.back();
    } catch {
      showAlert('Endereço', 'Não foi possível confirmar este ponto. Tente mover o marcador.');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webFallback} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backFab} onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.webTitle}>Mapa no celular</Text>
        <Text style={styles.webSub}>O ajuste fino no mapa funciona no app Android ou iOS. Use os campos de endereço na web.</Text>
        <TouchableOpacity style={styles.confirmBtn} onPress={() => router.back()}>
          <Text style={styles.confirmBtnText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const MM = mapModule;
  if (!MM) {
    return (
      <SafeAreaView style={styles.webFallback} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backFab} onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.webTitle}>Mapa indisponível</Text>
        <Text style={styles.webSub}>Não foi possível carregar o mapa neste dispositivo.</Text>
        <TouchableOpacity style={styles.confirmBtn} onPress={() => router.back()}>
          <Text style={styles.confirmBtnText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { MapView, Marker, PROVIDER_GOOGLE } = MM;
  const androidKey = getAndroidGoogleMapsKey();
  const mapProvider = Platform.OS === 'android' && androidKey ? PROVIDER_GOOGLE : undefined;

  const region = {
    latitude: coord.latitude,
    longitude: coord.longitude,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  return (
    <View style={styles.root}>
      {!initDone ? (
        <View style={styles.loadingMap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Carregando mapa…</Text>
        </View>
      ) : (
        <MapView
          style={StyleSheet.absoluteFill}
          provider={mapProvider}
          initialRegion={region}
          onMapReady={() => setMapReady(true)}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          <Marker coordinate={coord} draggable onDragEnd={onDragEnd} title="Entrega" />
        </MapView>
      )}

      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.backCircle} onPress={() => router.back()} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomSheet} edges={['bottom']}>
        <Text style={styles.sheetTitle}>Não é sua localização?</Text>
        <Text style={styles.sheetHint}>
          Arraste o marcador no mapa até a entrada da sua rua ou portaria. Isso melhora o cálculo da entrega.
        </Text>

        <View style={styles.previewBox}>
          {previewLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.previewText} numberOfLines={3}>
              {preview || '—'}
            </Text>
          )}
        </View>

        <View style={styles.warnRow}>
          <MaterialIcons name="info-outline" size={18} color={Colors.error} />
          <Text style={styles.warnText}>Confira se o pino está no local certo da entrega.</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (!mapReady || confirmLoading) && { opacity: 0.75 }]}
          onPress={onConfirm}
          disabled={!mapReady || confirmLoading}
          activeOpacity={0.9}
        >
          {confirmLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.confirmBtnText}>Confirmar local de entrega</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loadingMap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    gap: Spacing.sm,
  },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sheetHint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  previewBox: {
    minHeight: 56,
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: Spacing.md },
  warnText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  confirmBtnText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.white },
  webFallback: { flex: 1, padding: Spacing.lg, justifyContent: 'center', backgroundColor: Colors.background },
  webTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  webSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  backFab: { position: 'absolute', top: Spacing.lg, left: Spacing.md, zIndex: 2 },
});
