import type { GeocodeResult } from '@/services/mapsService';

export type CheckoutMapPickerResult = {
  lat: number;
  lng: number;
  geocode: GeocodeResult | null;
};

let buffer: CheckoutMapPickerResult | null = null;

export function commitCheckoutMapPickerResult(r: CheckoutMapPickerResult): void {
  buffer = r;
}

export function consumeCheckoutMapPickerResult(): CheckoutMapPickerResult | null {
  const x = buffer;
  buffer = null;
  return x;
}
