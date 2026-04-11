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
    .select('*, businesses(name, address, address_number, neighborhood, city, state, cep, phone)')
    .in('status', ['pending'])
    .order('created_at', { ascending: false });

  const all = (data ?? []).filter((d) => {
    if (d.order_source === 'app') {
      const paid = d.payment_status === 'paid';
      const ok = paid && d.merchant_acceptance === 'accepted';
      return ok;
    }
    return true;
  });
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
    .select('*, businesses(name, address, address_number, neighborhood, city, state, cep, phone)')
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
  const { data: row } = await supabase
    .from('deliveries')
    .select('order_source, merchant_acceptance')
    .eq('id', deliveryId)
    .single();
  if (row?.order_source === 'app' && row?.merchant_acceptance !== 'accepted') {
    return { error: 'O restaurante ainda não confirmou este pedido.' };
  }
  const { error } = await supabase
    .from('deliveries')
    .update({ motoboy_id: motoboyId, status: 'assigned', assigned_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .eq('status', 'pending');
  return { error: error ? error.message : null };
}

/** Comércio aceita pedido do app após pagamento (libera para motoboys). */
export async function businessAcceptAppOrder(
  deliveryId: string,
  businessId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('deliveries')
    .update({ merchant_acceptance: 'accepted' })
    .eq('id', deliveryId)
    .eq('business_id', businessId)
    .eq('merchant_acceptance', 'pending')
    .eq('payment_status', 'paid');
  return { error: error ? error.message : null };
}

/** Comércio recusa: estorno integral via Edge + pedido cancelado. */
export async function businessRejectAppOrder(
  deliveryId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('mp-refund-delivery', {
    body: { delivery_id: deliveryId },
  });
  if (error) return { error: error.message };
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { error: String(data.error) };
  }
  return { error: null };
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

/** Últimos 4 dígitos do celular (só números), estável por cliente — evita código aleatório duplicado. */
export function handoffCodeFromCustomerPhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 0) return '';
  return digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0');
}

/** Após coleta no comércio: em rota ao cliente + código = 4 últimos dígitos do celular do cliente. */
export async function markCollectedWithHandoffCode(
  deliveryId: string,
  motoboyId: string
): Promise<{ data: Delivery | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: row, error: fetchErr } = await supabase
    .from('deliveries')
    .select('id, customer_phone')
    .eq('id', deliveryId)
    .eq('motoboy_id', motoboyId)
    .eq('status', 'assigned')
    .maybeSingle();

  if (fetchErr) return { data: null, error: fetchErr.message };
  if (!row) return { data: null, error: 'Pedido não encontrado ou já coletado.' };

  const code = handoffCodeFromCustomerPhone(row.customer_phone);
  if (code.length !== 4) {
    return { data: null, error: 'Telefone do cliente sem dígitos válidos. Atualize o cadastro do pedido.' };
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'collected',
      collected_at: new Date().toISOString(),
      handoff_code: code,
    })
    .eq('id', deliveryId)
    .eq('motoboy_id', motoboyId)
    .eq('status', 'assigned')
    .select()
    .single();
  return { data: data as Delivery | null, error: error ? error.message : null };
}

/** Posição do entregador no mapa do cliente (atualizar com throttle no app). */
export async function updateMotoboyLocation(
  deliveryId: string,
  motoboyId: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('deliveries')
    .update({
      motoboy_lat: lat,
      motoboy_lng: lng,
      motoboy_location_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('motoboy_id', motoboyId)
    .in('status', ['assigned', 'collected']);
  return { error: error ? error.message : null };
}

/** Finaliza entrega somente se o código informado pelo entregador coincidir com o do pedido. */
export async function confirmDeliveryWithCode(
  deliveryId: string,
  motoboyId: string,
  code: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const normalized = String(code).replace(/\D/g, '').trim();
  const { data: row, error: fetchErr } = await supabase
    .from('deliveries')
    .select('handoff_code, status, motoboy_id')
    .eq('id', deliveryId)
    .single();

  if (fetchErr || !row) return { error: 'Pedido não encontrado.' };
  if (row.motoboy_id !== motoboyId) return { error: 'Esta corrida não está atribuída a você.' };
  if (row.status !== 'collected') return { error: 'Confirme primeiro a coleta no comércio.' };

  const expected = String(row.handoff_code ?? '').replace(/\D/g, '').trim();
  if (expected.length !== 4 || normalized !== expected) {
    return { error: 'Código incorreto. São os 4 últimos dígitos do celular do cliente (como no app dele).' };
  }

  const { error } = await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      handoff_code: null,
      motoboy_lat: null,
      motoboy_lng: null,
      motoboy_location_at: null,
    })
    .eq('id', deliveryId)
    .eq('motoboy_id', motoboyId)
    .eq('status', 'collected');

  return { error: error ? error.message : null };
}

export async function getCustomerDeliveries(customerUserId: string): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, phone)')
    .eq('customer_user_id', customerUserId)
    .order('created_at', { ascending: false })
    .limit(80);
  return (data ?? []) as Delivery[];
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

/** Admin: relatório de vendas (mais linhas + plano do comércio). */
export async function getAdminSalesDeliveries(): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, billing_plan), motoboys(name)')
    .order('created_at', { ascending: false })
    .limit(2000);
  return (data ?? []) as Delivery[];
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
    .select('*, businesses(name, address, address_number, neighborhood, city, state, cep, phone), motoboys(name, phone)')
    .eq('id', id)
    .single();
  return data;
}
