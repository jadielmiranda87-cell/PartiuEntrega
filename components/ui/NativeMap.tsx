/**
 * NativeMap.tsx — Native implementation (iOS / Android)
 *
 * Uses PROVIDER_DEFAULT (OpenStreetMap on Android, Apple Maps on iOS)
 * so no Google Maps API key is required in AndroidManifest.xml.
 *
 * Google Maps API is used server-side only (Edge Functions) for
 * Places Autocomplete, Directions and Geocoding — those never expose
 * the key to the client.
 *
 * ErrorBoundary catches any native crash that might slip through.
 */

import React, { Component, ReactNode } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ── Lazy require react-native-maps to avoid hard crash on import ──────────────
let RNMapView: any = null;
let RNMarker: any = null;
let RNPolyline: any = null;

try {
  const m = require('react-native-maps');
  RNMapView = m.default;
  RNMarker = m.Marker;
  RNPolyline = m.Polyline;
} catch {
  // Module unavailable — all guards below will prevent usage
}

// We never pass PROVIDER_GOOGLE to avoid requiring the native SDK key.
// Passing undefined uses PROVIDER_DEFAULT (OpenStreetMap / Apple Maps).
export const NATIVE_PROVIDER_GOOGLE = undefined;

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
// provider prop from the caller is intentionally ignored — always uses
// PROVIDER_DEFAULT (undefined) to avoid requiring the Google Maps SDK key.
export function NativeMapView(props: any) {
  const { style, children, provider: _ignored, ...rest } = props;

  if (!canShowMap) {
    return <MapPlaceholder style={style} />;
  }

  return (
    <MapErrorBoundary style={style}>
      <RNMapView
        style={style}
        provider={undefined}
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
    backgroundColor: '#0f0f1a',
    gap: 8,
  },
  placeholderTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderSub: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
