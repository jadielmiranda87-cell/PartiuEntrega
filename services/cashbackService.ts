import { getSupabaseClient } from '@/template';

export interface CashbackTransaction {
  id: string;
  motoboy_id: string;
  type: 'earned' | 'used';
  amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
}

export async function getCashbackBalance(motoboyId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('motoboys')
    .select('cashback_balance')
    .eq('id', motoboyId)
    .single();
  return data?.cashback_balance ?? 0;
}

export async function getCashbackTransactions(motoboyId: string): Promise<CashbackTransaction[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('cashback_transactions')
    .select('*')
    .eq('motoboy_id', motoboyId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function addCashbackTransaction(
  motoboyId: string,
  type: 'earned' | 'used',
  amount: number,
  description: string,
  referenceId?: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  // Insert transaction
  const { error: txError } = await supabase.from('cashback_transactions').insert({
    motoboy_id: motoboyId,
    type,
    amount,
    description,
    reference_id: referenceId ?? null,
  });
  if (txError) return { error: txError.message };

  // Update balance
  const current = await getCashbackBalance(motoboyId);
  const newBalance = type === 'earned' ? current + amount : Math.max(0, current - amount);
  const { error: balError } = await supabase
    .from('motoboys')
    .update({ cashback_balance: newBalance })
    .eq('id', motoboyId);

  return { error: balError ? balError.message : null };
}

export async function getReferralCodeForMotoboy(motoboyId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('motoboys')
    .select('referral_code')
    .eq('id', motoboyId)
    .single();
  return data?.referral_code ?? null;
}

export async function getMotoboyByReferralCode(code: string): Promise<{ id: string; name: string } | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('motoboys')
    .select('id, name')
    .eq('referral_code', code.trim().toUpperCase())
    .single();
  return data ?? null;
}

/**
 * Award cashback to the referrer motoboy when they successfully refer someone.
 * Called by admin approval flow (for motoboy referrals) or first delivery (for business referrals).
 */
export async function awardReferralCashback(
  referrerMotoboyId: string,
  amount: number,
  description: string,
  referenceId?: string
): Promise<{ error: string | null }> {
  return addCashbackTransaction(referrerMotoboyId, 'earned', amount, description, referenceId);
}
