import { getSupabaseClient } from '@/template';
import { Business } from '@/types';

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
  data: Partial<Pick<Business, 'billing_plan' | 'payment_api_key' | 'opening_hours'>>
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('businesses').update(data).eq('id', businessId);
  return { error: error ? error.message : null };
}
