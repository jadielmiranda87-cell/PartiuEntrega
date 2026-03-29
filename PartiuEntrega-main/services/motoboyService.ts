import { getSupabaseClient } from '@/template';
import { Motoboy, Subscription } from '@/types';

export async function createMotoboyProfile(
  userId: string,
  data: Partial<Motoboy>
): Promise<{ data: Motoboy | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('motoboys')
    .insert({ ...data, user_id: userId })
    .select()
    .single();
  return { data: result, error: error ? error.message : null };
}

export async function getMotoboyByUserId(userId: string): Promise<Motoboy | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('motoboys')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function getMotoboySubscriptions(motoboyId: string): Promise<Subscription[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('motoboy_id', motoboyId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function createSubscription(
  motoboyId: string,
  amount: number,
  isFirst: boolean
): Promise<{ data: Subscription | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ motoboy_id: motoboyId, amount, is_first_subscription: isFirst })
    .select()
    .single();
  return { data, error: error ? error.message : null };
}

export async function getAllMotoboys(): Promise<Motoboy[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('motoboys')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getPendingApprovalMotoboys(): Promise<Motoboy[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('motoboys')
    .select('*')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getMotoboySubscriptionsAdmin(motoboyId: string): Promise<Subscription[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('motoboy_id', motoboyId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function approveMotoboySubscription(
  subscriptionId: string,
  motoboyId: string,
  expiresAt: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  const { error: subError } = await supabase
    .from('subscriptions')
    .update({ admin_approved: true })
    .eq('id', subscriptionId);

  if (subError) return { error: subError.message };

  const { error: mbError } = await supabase
    .from('motoboys')
    .update({ status: 'active', subscription_expires_at: expiresAt, is_first_subscription: false })
    .eq('id', motoboyId);

  return { error: mbError ? mbError.message : null };
}

export async function getMotoboyReport(motoboyId: string): Promise<{
  totalRides: number;
  monthEarnings: number;
  lastActivity: string | null;
  paidSubscriptions: import('@/types').Subscription[];
}> {
  const supabase = getSupabaseClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [deliveriesRes, subsRes] = await Promise.all([
    supabase
      .from('deliveries')
      .select('id, price, delivered_at')
      .eq('motoboy_id', motoboyId)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('motoboy_id', motoboyId)
      .eq('payment_status', 'approved')
      .order('created_at', { ascending: false }),
  ]);

  const deliveries = deliveriesRes.data ?? [];
  const paidSubscriptions = subsRes.data ?? [];

  const monthEarnings = deliveries
    .filter((d) => d.delivered_at && d.delivered_at >= monthStart)
    .reduce((sum: number, d: any) => sum + Number(d.price ?? 0), 0);

  const lastActivity = deliveries.length > 0 ? deliveries[0].delivered_at : null;

  return { totalRides: deliveries.length, monthEarnings, lastActivity, paidSubscriptions };
}

export async function updateMotoboyStatus(
  motoboyId: string,
  status: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboys')
    .update({ status })
    .eq('id', motoboyId);
  return { error: error ? error.message : null };
}
