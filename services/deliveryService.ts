import { getSupabaseClient } from '@/template';
import { Delivery } from '@/types';

export async function createDelivery(data: Partial<Delivery>): Promise<{ data: Delivery | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('deliveries')
    .insert(data)
    .select()
    .single();
  return { data: result, error: error ? error.message : null };
}

export async function getBusinessDeliveries(businessId: string): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, motoboys(name, phone)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getPendingDeliveries(motoboyId?: string): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, address, address_number, neighborhood, city, state, phone)')
    .in('status', ['pending'])
    .order('created_at', { ascending: false });

  const all = data ?? [];
  if (!motoboyId) return all;

  // Filter out deliveries blocked by active cooldowns for this motoboy
  const now = new Date().toISOString();
  const { data: cooldowns } = await supabase
    .from('motoboy_cooldowns')
    .select('cooldown_type, business_id, cooldown_until')
    .eq('motoboy_id', motoboyId)
    .gt('cooldown_until', now);

  if (!cooldowns || cooldowns.length === 0) return all;

  const hasAcceptBlock = cooldowns.some((c) => c.cooldown_type === 'accept' && !c.business_id);
  if (hasAcceptBlock) return []; // global cooldown — no deliveries shown

  const blockedBusinessIds = new Set(
    cooldowns
      .filter((c) => c.cooldown_type === 'refuse' && c.business_id)
      .map((c) => c.business_id as string)
  );

  return all.filter((d) => !blockedBusinessIds.has(d.business_id));
}

export async function getMotoboyDeliveries(motoboyId: string): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, address, address_number, neighborhood, city, state, phone)')
    .eq('motoboy_id', motoboyId)
    .in('status', ['assigned', 'collected'])
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getMotoboyHistory(motoboyId: string): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name)')
    .eq('motoboy_id', motoboyId)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function acceptDelivery(deliveryId: string, motoboyId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('deliveries')
    .update({ motoboy_id: motoboyId, status: 'assigned', assigned_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .eq('status', 'pending');
  return { error: error ? error.message : null };
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: string,
  extra?: Record<string, string>
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('deliveries')
    .update({ status, ...extra })
    .eq('id', deliveryId);
  return { error: error ? error.message : null };
}

export async function getAllDeliveries(): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name), motoboys(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

/**
 * Motoboy cancels/refuses a ride BEFORE collect — sets it back to pending.
 */
export async function cancelDelivery(deliveryId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('deliveries')
    .update({
      status: 'pending',
      motoboy_id: null,
      assigned_at: null,
    })
    .eq('id', deliveryId)
    .eq('status', 'assigned'); // only allowed before collect
  return { error: error ? error.message : null };
}

export async function getDeliveryById(id: string): Promise<Delivery | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, address, address_number, neighborhood, city, state, phone), motoboys(name, phone)')
    .eq('id', id)
    .single();
  return data;
}
