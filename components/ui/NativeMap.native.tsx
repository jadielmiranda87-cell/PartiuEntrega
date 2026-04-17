/**
 * NativeMap.tsx — Native implementation (iOS / Android)
 *
 * Android: uses PROVIDER_GOOGLE when `EXPO_PUBLIC_GOOGLE_MAPS_KEY` is baked into
 * the manifest (same as `delivery-map-picker.native.tsx`); otherwise the default
 * provider (often OpenStreetMap via react-native-maps).
 * iOS: Apple Maps (default provider).
 *
 * ErrorBoundary catches any native crash that might slip through.
 */

import React, { Component, ReactNode } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';

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

// ── Lazy require react-native-maps to avoid hard crash on import ──────────────
let RNMapView: any = null;
let RNMarker: any = null;
let RNPolyline: any = null;
let RN_PROVIDER_GOOGLE: any = undefined;

try {
  const m = require('react-native-maps');
  RNMapView = m.default;
  RNMarker = m.Marker;
  RNPolyline = m.Polyline;
  RN_PROVIDER_GOOGLE = m.PROVIDER_GOOGLE;
} catch {
  // Module unavailable — all guards below will prevent usage
}

const androidMapsKey = Platform.OS === 'android' ? getAndroidGoogleMapsKey() : '';
const useGoogleOnAndroid = Platform.OS === 'android' && !!androidMapsKey && RN_PROVIDER_GOOGLE != null;

/** Same symbol as `PROVIDER_GOOGLE` when Android + manifest key; else undefined (caller may omit `provider`). */
export const NATIVE_PROVIDER_GOOGLE = useGoogleOnAndroid ? RN_PROVIDER_GOOGLE : undefined;

const canShowMap = Platform.OS !== 'web' && !!RNMapView;

// ── Placeholder shown when map cannot render ──────────────────────────────────
function MapPlaceholder({ style }: { style?: any }) {
  return (
    <View style={[style, styles.placeholder]}>
      <MaterialIcons name="map" size={36} color="#444" />
      <Text style={styles.placeholderTitle}>Mapa indisponível</Text>
      <Text style={styles.placeholderSub}>
        {'Não foi possível carregar o mapa\nneste dispositivo'}
      </Text>
    </View>
  );
}

// ── Error Boundary — catches any native SDK crash ─────────────────────────────
interface EBState { hasError: boolean }
class MapErrorBoundary extends Component<{ style?: any; children: ReactNode }, EBState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: any) {
    console.warn('[NativeMap] MapView error caught:', e?.message ?? e);
  }
  render() {
    if (this.state.hasError) return <MapPlaceholder style={this.props.style} />;
    return this.props.children;
  }
}

// ── Safe MapView wrapper ──────────────────────────────────────────────────────
// Matches checkout map picker: Google on Android when key is present; else default.
export function NativeMapView(props: any) {
  const { style, children, provider: _ignored, ...rest } = props;
  const mapProvider = useGoogleOnAndroid ? RN_PROVIDER_GOOGLE : undefined;

  if (!canShowMap) {
    return <MapPlaceholder style={style} />;
  }

  return (
    <MapErrorBoundary style={style}>
      <RNMapView
        style={style}
        provider={mapProvider}
        {...rest}
      >
        {children}
      </RNMapView>
    </MapErrorBoundary>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
export function NativeMarker(props: any) {
  if (!canShowMap) return null;
  return <RNMarker {...props} />;
}

export function NativePolyline(props: any) {
  if (!canShowMap) return null;
  return <RNPolyline {...props} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
    gap: 8,
  },
  placeholderTitle: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
