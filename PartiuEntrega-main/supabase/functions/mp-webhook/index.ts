import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Mercado Pago sends both JSON body and query params
    const url = new URL(req.url);
    const topicParam = url.searchParams.get('topic');
    const idParam = url.searchParams.get('id');

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // query-param style webhook — no JSON body
    }

    const type = (body.type as string) ?? topicParam ?? '';
    const dataId = (body as any)?.data?.id ?? idParam ?? '';

    console.log(`Webhook received: type=${type}, id=${dataId}`);

    if ((type === 'payment' || topicParam === 'payment') && dataId) {
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });

      if (!paymentRes.ok) {
        const errText = await paymentRes.text();
        console.error('Failed to fetch payment:', errText);
        return new Response('error fetching payment', {
          status: 400,
          headers: corsHeaders,
        });
      }

      const payment = await paymentRes.json();
      console.log(`Payment status: ${payment.status}, reference: ${payment.external_reference}`);

      if (payment.status === 'approved' && payment.external_reference) {
        const [motoboyId, subscriptionId] = payment.external_reference.split('|');

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Update subscription record
        await supabase
          .from('subscriptions')
          .update({
            payment_status: 'approved',
            expires_at: expiresAt.toISOString(),
            payment_id: String(dataId),
          })
          .eq('id', subscriptionId);

        // Fetch motoboy to check is_first_subscription
        const { data: motoboy } = await supabase
          .from('motoboys')
          .select('is_first_subscription, cashback_balance')
          .eq('id', motoboyId)
          .single();

        if (motoboy?.is_first_subscription) {
          // First subscription → wait for admin approval
          await supabase
            .from('motoboys')
            .update({ status: 'pending_approval' })
            .eq('id', motoboyId);
        } else {
          // Renewal → auto-activate; apply cashback if balance > 0
          const cashback = Number(motoboy?.cashback_balance ?? 0);
          const updatePayload: Record<string, unknown> = {
            status: 'active',
            subscription_expires_at: expiresAt.toISOString(),
          };
          if (cashback > 0) {
            updatePayload.cashback_balance = 0; // deduct full cashback used
          }

          await supabase.from('motoboys').update(updatePayload).eq('id', motoboyId);

          await supabase
            .from('subscriptions')
            .update({ admin_approved: true })
            .eq('id', subscriptionId);

          // Record cashback deduction transaction if any
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

        console.log(`Motoboy ${motoboyId} updated after payment ${dataId}`);
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
