import type { Business, Delivery } from '@/types';
import { geocodeAddress, type GeoLocation } from '@/services/mapsService';

function businessLine(b: Business): string {
  return `${b.address}, ${b.address_number}, ${b.neighborhood}, ${b.city}, ${b.state}, ${b.cep}, Brasil`;
}

function customerLine(d: Delivery): string {
  return `${d.customer_address}, ${d.customer_address_number}, ${d.customer_neighborhood}, ${d.customer_city}, ${d.customer_state}, ${d.customer_cep}, Brasil`;
}

/**
 * Pontos do comércio e do cliente para mapa / rotas.
 * Cliente: GPS salvo no pedido (`delivery_lat`/`delivery_lng`) ou geocoding do endereço.
 */
export async function resolveDeliveryEndpoints(
  delivery: Delivery,
  business: Business | null | undefined
): Promise<{ business: GeoLocation | null; customer: GeoLocation | null }> {
  let businessLoc: GeoLocation | null = null;
  if (business) {
    const g = await geocodeAddress(businessLine(business));
    businessLoc = g?.location ?? null;
  }

  let customerLoc: GeoLocation | null = null;
  const lat = delivery.delivery_lat;
  const lng = delivery.delivery_lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    customerLoc = { lat, lng };
  } else {
    const g = await geocodeAddress(customerLine(delivery));
    customerLoc = g?.location ?? null;
  }

  return { business: businessLoc, customer: customerLoc };
}
