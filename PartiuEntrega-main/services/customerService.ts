import { getSupabaseClient } from '@/template';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  address: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  created_at: string;
  updated_at: string;
}

export async function searchCustomers(businessId: string, query: string): Promise<Customer[]> {
  if (!query || query.trim().length < 2) return [];
  const supabase = getSupabaseClient();
  const q = query.trim();
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .ilike('name', `%${q}%`)
    .order('name', { ascending: true })
    .limit(10);
  return data ?? [];
}

export async function getBusinessCustomers(businessId: string): Promise<Customer[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });
  return data ?? [];
}

export async function upsertCustomer(
  businessId: string,
  customer: Omit<Customer, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  // Try to upsert by phone + business_id
  await supabase
    .from('customers')
    .upsert(
      {
        business_id: businessId,
        ...customer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id,phone', ignoreDuplicates: false }
    );
}
