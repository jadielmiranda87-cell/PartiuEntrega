import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { normalizeBrazilDeliveryPoint } from '@/utils/geoBrazil';

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

// ─── Distância para taxa de entrega: somente Google Directions (Edge `maps-directions`) ───

export function haversineKm(a: GeoLocation, b: GeoLocation): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Rota de carro não costuma ser > ~20× a linha reta em trechos urbanos; acima disso costuma ser geocode/coord errada. */
function isPlausibleDrivingVsGreatCircle(greatCircleKm: number, drivingKm: number): boolean {
  if (!Number.isFinite(drivingKm) || drivingKm < 0) return false;
  if (drivingKm > 6000) return false;
  if (!Number.isFinite(greatCircleKm) || greatCircleKm <= 0) return drivingKm < 8000;
  if (greatCircleKm < 0.02) return drivingKm < 1;
  if (greatCircleKm > 800) return drivingKm >= greatCircleKm * 0.75 && drivingKm <= greatCircleKm * 4;
  const ratio = drivingKm / greatCircleKm;
  return ratio >= 0.9 && ratio <= 22;
}

/**
 * Distância em km para precificação — **somente** Google Directions (via Edge + `GOOGLE_MAPS_API_KEY`).
 * Sem OSRM nem estimativa por linha reta: se a rota não for obtida ou for incompatível com os pontos, retorna `null`.
 */
export async function getDrivingDistanceKm(
  origin: GeoLocation,
  dest: GeoLocation
): Promise<{ km: number; source: 'google' | 'haversine' } | null> {
  const o = { lat: Number(origin.lat.toFixed(6)), lng: Number(origin.lng.toFixed(6)) };
  const d = { lat: Number(dest.lat.toFixed(6)), lng: Number(dest.lng.toFixed(6)) };

  console.log('[MapsService] Tentando Google Directions via OnSpace...');

  const straight = haversineKm(o, d);

  try {
    const direct = await getDirections(o, d);
    if (direct?.distance?.value != null) {
      const km = Math.round((direct.distance.value / 1000) * 10) / 10;
      if (isPlausibleDrivingVsGreatCircle(straight, km)) {
        console.log('[MapsService] Distancia obtida do Google:', km, 'km');
        return { km, source: 'google' };
      }
    }
  } catch (err) {
    console.log('[MapsService] Erro na Edge Function, usando fallback de linha reta.');
  }

  // Se o Google falhar ou retornar erro, usa a linha reta + 20% de margem (estimativa urbana)
  const estimatedKm = Math.round((straight * 1.2) * 10) / 10;
  console.log('[MapsService] Usando Haversine (linha reta + 20%):', estimatedKm, 'km');

  return { km: estimatedKm, source: 'haversine' };
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
