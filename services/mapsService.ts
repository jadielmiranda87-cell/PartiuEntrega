import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface DirectionsResult {
  polyline: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_location: GeoLocation;
  end_location: GeoLocation;
}

export interface GeocodeResult {
  place_id: string;
  formatted_address: string;
  location: GeoLocation;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function invokeEdge<T>(fn: string, body: object): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const text = await error.context?.text();
        msg = text || msg;
      } catch { /* ignore */ }
    }
    return { data: null, error: msg };
  }
  return { data: data as T, error: null };
}

// ─── Places Autocomplete ─────────────────────────────────────────────────────

export async function getAddressSuggestions(
  input: string,
  sessiontoken?: string
): Promise<PlacePrediction[]> {
  const { data, error } = await invokeEdge<{ predictions: PlacePrediction[] }>('maps-places', {
    input,
    sessiontoken,
  });
  if (error || !data) return [];
  return data.predictions ?? [];
}

// ─── Geocode (address or place_id → lat/lng) ─────────────────────────────────

export async function geocodeAddress(
  address?: string,
  place_id?: string
): Promise<GeocodeResult | null> {
  const { data, error } = await invokeEdge<{ result: GeocodeResult | null }>('maps-geocode', {
    address,
    place_id,
  });
  if (error || !data?.result) return null;
  return data.result;
}

// ─── Directions (origin → destination) ───────────────────────────────────────

export async function getDirections(
  origin: string | GeoLocation,
  destination: string | GeoLocation
): Promise<DirectionsResult | null> {
  const { data, error } = await invokeEdge<DirectionsResult>('maps-directions', {
    origin,
    destination,
  });
  if (error || !data) return null;
  return data;
}

// ─── Decode Google polyline ───────────────────────────────────────────────────

export function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const poly: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return poly;
}
