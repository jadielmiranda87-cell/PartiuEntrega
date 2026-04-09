import { getSupabaseClient } from '@/template';
import type { CustomerMpCard } from '@/types';

export async function listCustomerMpCards(): Promise<CustomerMpCard[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('customer_mp_cards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('listCustomerMpCards', error.message);
    return [];
  }
  return (data ?? []) as CustomerMpCard[];
}

export async function deleteCustomerMpCard(id: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('customer_mp_cards').delete().eq('id', id);
  return { error: error ? error.message : null };
}
