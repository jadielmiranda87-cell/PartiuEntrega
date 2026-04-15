import { getSupabaseClient } from '@/template';
import { Business } from '@/types';
import { geocodeAddress } from '@/services/mapsService';

export async function createBusinessProfile(
  userId: string,
  data: Partial<Business>
): Promise<{ data: Business | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('businesses')
    .insert({ ...data, user_id: userId })
    .select()
    .single();
  return { data: result, error: error ? error.message : null };
}

export async function getAllBusinesses(): Promise<Business[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function updateBusinessProfile(
  businessId: string,
  data: Partial<Pick<Business, 'name' | 'billing_plan' | 'payment_api_key' | 'opening_hours' | 'latitude' | 'longitude'>>
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('businesses').update(data).eq('id', businessId);
  return { error: error ? error.message : null };
}

/** Monta endereço para geocode e grava latitude/longitude (vitrine por distância no app cliente). */
function businessLineForGeocode(b: {
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
}): string {
  return `${b.address}, ${b.address_number} - ${b.neighborhood}, ${b.city} - ${b.state}, ${b.cep}, Brasil`;
}

/** Chame após criar/atualizar endereço do comércio. Falha silenciosa se o Edge de mapas estiver indisponível. */
export async function syncBusinessCoordinates(businessId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: b, error: fetchErr } = await supabase
    .from('businesses')
    .select('address, address_number, neighborhood, city, state, cep')
    .eq('id', businessId)
    .single();
  if (fetchErr || !b) return;
  const line = businessLineForGeocode(b);
  const geo = await geocodeAddress(line);
  if (!geo?.location) return;
  await supabase
    .from('businesses')
    .update({ latitude: geo.location.lat, longitude: geo.location.lng })
    .eq('id', businessId);
}
