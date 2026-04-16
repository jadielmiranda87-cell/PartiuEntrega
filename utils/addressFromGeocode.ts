import type { GeocodeResult } from '@/services/mapsService';

function pickComponent(
  components: GeocodeResult['address_components'],
  type: string,
  useShort = false
): string | undefined {
  const c = components.find((x) => x.types.includes(type));
  if (!c) return undefined;
  return useShort ? c.short_name : c.long_name;
}

/** Preenche campos do checkout a partir do resultado do Google Geocoding (Brasil). */
export function addressFormFromGeocode(g: GeocodeResult): {
  customerAddress: string;
  customerNumber: string;
  customerNeighborhood: string;
  customerCity: string;
  customerState: string;
  customerCep: string;
} {
  const comps = g.address_components ?? [];
  const route = pickComponent(comps, 'route') ?? '';
  const streetNumber = pickComponent(comps, 'street_number') ?? '';
  const neighborhood =
    pickComponent(comps, 'sublocality_level_1') ??
    pickComponent(comps, 'sublocality') ??
    pickComponent(comps, 'neighborhood') ??
    pickComponent(comps, 'administrative_area_level_3') ??
    '';
  const city =
    pickComponent(comps, 'locality') ??
    pickComponent(comps, 'administrative_area_level_2') ??
    '';
  const stateRaw = pickComponent(comps, 'administrative_area_level_1', true) ?? '';
  const state = stateRaw.length >= 2 ? stateRaw.slice(0, 2).toUpperCase() : stateRaw.toUpperCase();
  const cep = (pickComponent(comps, 'postal_code') ?? '').replace(/\D/g, '');

  const streetLine =
    route ||
    g.formatted_address
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0] ||
    '';

  return {
    customerAddress: streetLine,
    customerNumber: streetNumber,
    customerNeighborhood: neighborhood,
    customerCity: city,
    customerState: state,
    customerCep: cep,
  };
}
