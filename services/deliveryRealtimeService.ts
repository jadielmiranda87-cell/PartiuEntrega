import { getSupabaseClient } from '@/template';

const DEBOUNCE_MS = 150;

function debounced(onChange: () => void) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      onChange();
      t = null;
    }, DEBOUNCE_MS);
  };
}

/**
 * Qualquer INSERT/UPDATE/DELETE em `deliveries` (ex.: novo pedido, aceite, cancelamento).
 * Requer a tabela `deliveries` na publicação Realtime do Supabase (Dashboard → Database → Replication).
 */
export function subscribeDeliveriesTable(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const run = debounced(onChange);
  const channel = supabase
    .channel(`deliveries-all-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, run)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Apenas mudanças nos pedidos deste comércio. */
export function subscribeBusinessDeliveries(businessId: string, onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const run = debounced(onChange);
  const channel = supabase
    .channel(`deliveries-biz-${businessId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'deliveries',
        filter: `business_id=eq.${businessId}`,
      },
      run
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


