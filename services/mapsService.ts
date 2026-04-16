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
  place_id?: string,
  options?: { components?: string }
): Promise<GeocodeResult | null> {
  const payload: { address?: string; place_id?: string; components?: string } = {};
  if (address != null && address !== '') payload.address = address;
  if (place_id != null && place_id !== '') payload.place_id = place_id;
  if (options?.components) payload.components = options.components;
  const { data, error } = await invokeEdge<{ result: GeocodeResult | null }>('maps-geocode', payload);
  if (error || !data?.result) return null;
  return data.result;
}

/** Converte latitude/longitude (ex.: pin do WhatsApp / Google Maps) em endereço estruturado. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const latlng = `${lat},${lng}`;
  const { data, error } = await invokeEdge<{ result: GeocodeResult | null }>('maps-geocode', {
    latlng,
  });
  if (error || !data?.result) return null;
  return data.result;
}

// ─── Directions (origin → destination) ───────────────────────────────────────

export async function getDirections(
  origin: string | GeoLocation,
  destination: string | GeoLocation
): Promise<DirectionsResult | null> {
  const { data, error } = await invokeEdge<DirectionsResult & { error?: string }>('maps-directions', {
    origin,
    destination,
  });
  if (error || !data) return null;
  if (typeof (data as { error?: string }).error === 'string') return null;
  if (!(data as DirectionsResult).distance?.value) return null;
  return data as DirectionsResult;
}

// ─── Distância para taxa de entrega: Google (servidor) → OSRM → linha reta ajustada ───

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12_000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getOsrmDistanceKm(origin: GeoLocation, dest: GeoLocation): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'PartiuEntrega/1.0' } });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: string; routes?: Array<{ distance: number }> };
    if (json.code !== 'Ok' || !json.routes?.length) return null;
    return Math.round((json.routes[0].distance / 1000) * 10) / 10;
  } catch {
    return null;
  }
}

function haversineKm(a: GeoLocation, b: GeoLocation): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/**
 * Distância em km para precificação de entrega.
 * 1) Google Directions (Edge `maps-directions` + secret `GOOGLE_MAPS_API_KEY` no Supabase/OnSpace)
 * 2) OSRM público (estrada aproximada)
 * 3) Haversine × 1,35 (último recurso; estradas costumam ser ~20–40% maiores que linha reta)
 */
export async function getDrivingDistanceKm(
  origin: GeoLocation,
  dest: GeoLocation
): Promise<{ km: number; source: 'google' | 'osrm' | 'approx' } | null> {
  const direct = await getDirections(origin, dest);
  if (direct?.distance?.value) {
    return { km: Math.round((direct.distance.value / 1000) * 10) / 10, source: 'google' };
  }
  const osrm = await getOsrmDistanceKm(origin, dest);
  if (osrm != null) return { km: osrm, source: 'osrm' };
  const h = haversineKm(origin, dest);
  if (!Number.isFinite(h) || h <= 0) return null;
  return { km: Math.round(h * 1.35 * 10) / 10, source: 'approx' };
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
