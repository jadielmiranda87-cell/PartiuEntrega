import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type DeliveryPaymentAction = 'preference' | 'pix' | 'saved_card';

export async function invokeDeliveryPayment(body: {
  action: DeliveryPaymentAction;
  delivery_id: string;
  saved_card_id?: string;
}): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('mp-delivery-payment', { body });

  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const t = await error.context?.text();
        if (t) {
          const j = JSON.parse(t) as { error?: string };
          if (j?.error) msg = j.error;
        }
      } catch {
        /* ignore */
      }
    }
    return { data: null, error: msg };
  }

  const errMsg = (data as { error?: string })?.error;
  if (errMsg) return { data: null, error: errMsg };

  return { data: data as Record<string, unknown>, error: null };
}
