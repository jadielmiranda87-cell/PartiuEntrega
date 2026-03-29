import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { motoboy_id, subscription_id, amount, payer_email, payer_name } = await req.json();

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const preference = {
      items: [
        {
          id: subscription_id,
          title: 'Assinatura Motoboy - 30 dias',
          quantity: 1,
          unit_price: Number(amount),
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: payer_email,
        name: payer_name,
      },
      external_reference: `${motoboy_id}|${subscription_id}`,
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: 'PartiuEntrega',
      expires: false,
      back_urls: {
        success: `${supabaseUrl}/functions/v1/mp-webhook`,
        failure: `${supabaseUrl}/functions/v1/mp-webhook`,
        pending: `${supabaseUrl}/functions/v1/mp-webhook`,
      },
      auto_return: 'approved',
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      const errText = await mpResponse.text();
      console.error('MP Error:', errText);
      return new Response(JSON.stringify({ error: `MercadoPago: ${errText}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prefData = await mpResponse.json();

    // Save preference id on subscription record
    await supabase
      .from('subscriptions')
      .update({ payment_id: prefData.id })
      .eq('id', subscription_id);

    console.log(`Payment preference created: ${prefData.id} for motoboy ${motoboy_id}`);

    return new Response(
      JSON.stringify({
        checkout_url: prefData.init_point,
        sandbox_url: prefData.sandbox_init_point,
        preference_id: prefData.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('mp-payment error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
