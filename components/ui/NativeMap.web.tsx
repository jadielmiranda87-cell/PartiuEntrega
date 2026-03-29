// Web stub — react-native-maps is native-only.
// Returns null placeholders so the web preview doesn't crash.
import React from 'react';
import { View } from 'react-native';

export const NATIVE_PROVIDER_GOOGLE = undefined;

export function NativeMapView({ children, style, ...props }: any) {
  return <View style={style} />;
}

export function NativeMarker(_props: any) { return null; }
export function NativePolyline(_props: any) { return null; }
