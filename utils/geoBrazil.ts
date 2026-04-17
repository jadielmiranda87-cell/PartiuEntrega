/** Limites amplos do território brasileiro (graus decimais). */
const BR_LAT_MIN = -34.1;
const BR_LAT_MAX = 5.6;
const BR_LNG_MIN = -74.1;
const BR_LNG_MAX = -34.0;

export function isInsideBrazilBox(lat: number, lng: number): boolean {
  return lat >= BR_LAT_MIN && lat <= BR_LAT_MAX && lng >= BR_LNG_MIN && lng <= BR_LNG_MAX;
}

/**
 * Corrige lat/lng trocados (ex.: pin ou cadastro salvando longitude na coluna latitude).
 * Se (lat,lng) não cai no Brasil mas (lng,lat) cai, devolve o par corrigido.
 */
export function normalizeBrazilDeliveryPoint(p: { lat: number; lng: number }): { lat: number; lng: number } {
  const { lat, lng } = p;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return p;
  if (isInsideBrazilBox(lat, lng)) return { lat, lng };
  if (isInsideBrazilBox(lng, lat)) return { lat: lng, lng: lat };
  return p;
}
