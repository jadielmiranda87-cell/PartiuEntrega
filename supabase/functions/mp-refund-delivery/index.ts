import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!MP_ACCESS_TOKEN || !supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user?.id) {
    return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { delivery_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const deliveryId = body.delivery_id;
  if (!deliveryId) {
    return new Response(JSON.stringify({ error: 'delivery_id obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: biz } = await admin.from('businesses').select('id').eq('user_id', user.id).maybeSingle();
  if (!biz?.id) {
    return new Response(JSON.stringify({ error: 'Apenas conta comércio' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: d, error: dErr } = await admin
    .from('deliveries')
    .select(
      'id, business_id, order_source, payment_status, merchant_acceptance, mp_payment_id, status'
    )
    .eq('id', deliveryId)
    .single();

  if (dErr || !d) {
    return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (d.business_id !== biz.id) {
    return new Response(JSON.stringify({ error: 'Pedido de outro comércio' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (d.order_source !== 'app') {
    return new Response(JSON.stringify({ error: 'Somente pedidos do app' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (d.payment_status === 'refunded' && d.merchant_acceptance === 'rejected') {
    return new Response(JSON.stringify({ ok: true, already: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (d.payment_status !== 'paid' || d.merchant_acceptance !== 'pending') {
    return new Response(JSON.stringify({ error: 'Pedido não está aguardando confirmação' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const mpId = d.mp_payment_id as string | null;
  if (!mpId) {
    return new Response(JSON.stringify({ error: 'Pagamento Mercado Pago não encontrado' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({}),
  });

  const refundText = await mpRes.text();
  if (!mpRes.ok) {
    console.error('MP refund error:', refundText);
    return new Response(JSON.stringify({ error: `Mercado Pago: ${refundText}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await admin
    .from('deliveries')
    .update({
      merchant_acceptance: 'rejected',
      payment_status: 'refunded',
      status: 'cancelled',
    })
    .eq('id', deliveryId)
    .eq('business_id', biz.id);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
