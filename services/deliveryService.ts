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
    // Regra: Comércio só vê pedidos pagos (ou cancelados/entregues que já foram pagos um dia)
    // Pedidos 'pending_payment' ficam ocultos para o restaurante.
    .neq('payment_status', 'awaiting_payment')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getPendingDeliveries(motoboyId?: string): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, address, address_number, neighborhood, city, state, cep, phone)')
    .in('status', ['pending'])
    // Regra: Motoboy só vê pedidos pagos E já aceitos pelo comércio
    .eq('payment_status', 'paid')
    .not('business_accepted_at', 'is', null)
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

/**
 * Motoboy desiste da entrega antes da coleta.
 * O pedido volta a ficar disponível ('pending') para outros entregadores.
 */
export async function motoboyAbandonDelivery(deliveryId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('deliveries')
    .update({
      status: 'pending',
      motoboy_id: null,
      assigned_at: null,
      motoboy_lat: null,
      motoboy_lng: null
    })
    .eq('id', deliveryId)
    .eq('status', 'assigned'); // Só permite se ainda não foi coletado

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

export async function businessCancelDelivery(deliveryId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  // 1. Busca os dados do pedido para checar o status de pagamento
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('payment_status, id')
    .eq('id', deliveryId)
    .single();

  // 2. Se o pedido já foi pago, precisamos processar o reembolso
  if (delivery?.payment_status === 'paid') {
    const { error: refundError } = await supabase.functions.invoke('mp-delivery-payment', {
      body: { action: 'refund', delivery_id: deliveryId }
    });
    if (refundError) return { error: 'Falha ao processar reembolso no Mercado Pago: ' + refundError.message };
  }

  // 3. Atualiza o status do pedido para cancelado
  const { error } = await supabase
    .from('deliveries')
    .update({ status: 'cancelled' })
    .eq('id', deliveryId);

  return { error: error ? error.message : null };
}

/**
 * Admin: fetches all non-cancelled deliveries with business info for sales report.
 */
export async function getAdminSalesDeliveries(): Promise<Delivery[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('deliveries')
    .select('*, businesses(name, billing_plan)')
    .neq('status', 'cancelled')
    .gt('price', 0)
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []) as Delivery[];
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

/**
 * Cliente solicita cancelamento com reembolso.
 * Só é permitido se o comércio ainda não aceitou o pedido.
 */
export async function customerCancelWithRefund(deliveryId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  // 1. Verifica status atual e se já foi aceito pelo comércio
  const { data: delivery, error: fetchError } = await supabase
    .from('deliveries')
    .select('status, business_accepted_at, payment_status')
    .eq('id', deliveryId)
    .single();

  if (fetchError || !delivery) return { error: 'Pedido não encontrado.' };

  if (delivery.business_accepted_at) {
    return { error: 'O comércio já aceitou seu pedido. Cancelamento não é mais possível por aqui.' };
  }

  if (delivery.status === 'cancelled') {
    return { error: 'Este pedido já está cancelado.' };
  }

  // 2. Processa o reembolso se estiver pago
  if (delivery.payment_status === 'paid') {
    try {
      const { error: refundError } = await supabase.functions.invoke('mp-delivery-payment', {
        body: { action: 'refund', delivery_id: deliveryId }
      });
      if (refundError) throw new Error('Falha no reembolso: ' + refundError.message);
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // 3. Atualiza para cancelado
  const { error: updateError } = await supabase
    .from('deliveries')
    .update({
      status: 'cancelled',
      notes: 'Cancelado pelo cliente (reembolso automático)'
    })
    .eq('id', deliveryId)
    .is('business_accepted_at', null); // Garantia extra anti-concorrência

  if (updateError) return { error: 'O comércio aceitou o pedido no exato momento. Cancelamento impedido.' };

  return { error: null };
}
