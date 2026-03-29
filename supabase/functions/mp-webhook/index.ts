import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function htmlPage(opts: { title: string; body: string; deepLink: string }) {
  const { title, body, deepLink } = opts;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="refresh" content="2;url=${deepLink}"/>
<title>${title}</title>
<style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d0d0d;color:#f5f5f5;margin:0;padding:28px 20px;text-align:center;min-height:100vh;box-sizing:border-box;}
h1{font-size:1.15rem;margin:0 0 14px;font-weight:700;color:#fff;}
p{color:#b3b3b3;line-height:1.55;font-size:15px;margin:0 0 18px;}
a{display:inline-block;margin-top:8px;padding:14px 22px;background:#ff6b00;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;}
.note{font-size:13px;color:#888;margin-top:20px;}
</style>
</head>
<body>
<h1>${title}</h1>
<p>${body}</p>
<a href="${deepLink}">Abrir app PartiuEntrega</a>
<p class="note">Se o app não abrir automaticamente, use o botão acima.</p>
<script>
(function(){
  var u=${JSON.stringify(deepLink)};
  try{window.location.href=u;}catch(e){}
})();
</script>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const mp = (url.searchParams.get('mp') || '').toLowerCase();
  const collectionStatus = (url.searchParams.get('collection_status') || '').toLowerCase();

  // Se for redirect do navegador (back_urls), devolve HTML amigável
  if (mp || collectionStatus) {
    const deepLink = 'PartiuEntrega://payment?mp_return=1';

    let title = 'Pagamento';
    let body = 'Volte ao app PartiuEntrega e toque em <strong>Atualizar status do pagamento</strong> para concluir.';

    const status = collectionStatus || mp;
    if (status === 'approved' || status === 'success') {
      title = 'Pagamento aprovado';
      body = 'Se o Mercado Pago mostrou confirmação, volte ao app e toque em <strong>Atualizar status do pagamento</strong>.';
    } else if (status === 'pending') {
      title = 'Pagamento pendente';
      body = 'O pagamento ainda está sendo processado. Volta ao app e atualize o status em alguns instantes.';
    } else if (status === 'failed' || status === 'failure' || status === 'rejected') {
      title = 'Pagamento não concluído';
      body = 'Você pode tentar de novo pelo app PartiuEntrega quando quiser.';
    }

    return new Response(htmlPage({ title, body, deepLink }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // A partir daqui: webhook normal (server-to-server)
  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const topicParam = url.searchParams.get('topic');
    const idParam = url.searchParams.get('id');

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // sem JSON
    }

    const type = (body.type as string) ?? topicParam ?? '';
    const dataId = (body as any)?.data?.id ?? idParam ?? '';

    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((type === 'payment' || topicParam === 'payment') && dataId) {
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });

      if (!paymentRes.ok) {
        const errText = await paymentRes.text();
        console.error('Failed to fetch payment:', errText);
        return new Response('error fetching payment', { status: 400, headers: corsHeaders });
      }

      const payment = await paymentRes.json();

      if (payment.status === 'approved' && payment.external_reference) {
        const [motoboyId, subscriptionId] = payment.external_reference.split('|');

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabase
          .from('subscriptions')
          .update({
            payment_status: 'approved',
            expires_at: expiresAt.toISOString(),
            payment_id: String(dataId),
          })
          .eq('id', subscriptionId);

        const { data: motoboy } = await supabase
          .from('motoboys')
          .select('is_first_subscription, cashback_balance')
          .eq('id', motoboyId)
          .single();

        if (motoboy?.is_first_subscription) {
          await supabase.from('motoboys').update({ status: 'pending_approval' }).eq('id', motoboyId);
        } else {
          const cashback = Number(motoboy?.cashback_balance ?? 0);
          const updatePayload: Record<string, unknown> = {
            status: 'active',
            subscription_expires_at: expiresAt.toISOString(),
          };
          if (cashback > 0) updatePayload.cashback_balance = 0;

          await supabase.from('motoboys').update(updatePayload).eq('id', motoboyId);

          await supabase.from('subscriptions').update({ admin_approved: true }).eq('id', subscriptionId);

          if (cashback > 0) {
            await supabase.from('cashback_transactions').insert({
              motoboy_id: motoboyId,
              type: 'debit',
              amount: -cashback,
              description: 'Cashback usado na renovação',
              reference_id: subscriptionId,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('mp-webhook error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});