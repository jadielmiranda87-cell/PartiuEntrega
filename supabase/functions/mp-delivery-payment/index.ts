import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Action = 'preference' | 'pix' | 'saved_card' | 'refund';

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
  if (authErr || !user?.email) {
    return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { action?: Action; delivery_id?: string; saved_card_id?: string; };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const action = body.action;
  const deliveryId = body.delivery_id;
  if (!action || !deliveryId) {
    return new Response(JSON.stringify({ error: 'action e delivery_id são obrigatórios' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: delivery, error: dErr } = await admin
    .from('deliveries')
    .select('id, price, customer_name, customer_user_id, payment_status, mp_payment_id, business_id')
    .eq('id', deliveryId)
    .single();

  if (dErr || !delivery) {
    return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Refund action: allowed for business owner or the customer themselves ---
  if (action === 'refund') {
    // Verify caller is either the customer or the business owner
    const isCustomer = delivery.customer_user_id === user.id;
    let isBusiness = false;
    if (!isCustomer) {
      const { data: biz } = await admin
        .from('businesses')
        .select('id')
        .eq('id', delivery.business_id)
        .eq('user_id', user.id)
        .maybeSingle();
      isBusiness = !!biz;
    }
    if (!isCustomer && !isBusiness) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (delivery.payment_status === 'refunded') {
      return new Response(JSON.stringify({ error: 'Pedido já reembolsado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpPaymentId = delivery.mp_payment_id;
    if (!mpPaymentId) {
      return new Response(JSON.stringify({ error: 'Pedido sem ID de pagamento Mercado Pago — não é possível reembolsar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const refundRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(mpPaymentId)}/refunds`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({}), // reembolso total; enviar { amount } para parcial
        }
      );

      const refundText = await refundRes.text();
      console.log(`MP refund delivery=${deliveryId} payment=${mpPaymentId} status=${refundRes.status} body=${refundText}`);

      if (!refundRes.ok) {
        return new Response(JSON.stringify({ error: `Mercado Pago: ${refundText}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refundData = JSON.parse(refundText);

      await admin
        .from('deliveries')
        .update({ payment_status: 'refunded' })
        .eq('id', deliveryId);

      return new Response(
        JSON.stringify({
          ok: true,
          refund_id: refundData.id,
          status: refundData.status,
          amount: refundData.amount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('mp-delivery-payment refund error:', err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // --- Payment actions: customer-only ---
  if (delivery.customer_user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Acesso negado' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (delivery.payment_status === 'paid') {
    return new Response(JSON.stringify({ error: 'Pedido já pago' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const amount = Number(delivery.price);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Valor inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const extRef = `delivery:${deliveryId}`;
  const notificationUrl = `${supabaseUrl}/functions/v1/mp-webhook`;
  const returnBase = `${supabaseUrl}/functions/v1/mp-webhook`;

  const mpHeaders = {
    Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  /** MP exige X-Idempotency-Key em POST /v1/payments (Pix, cartão token, etc.). */
  const mpPaymentHeaders = () => ({
    ...mpHeaders,
    'X-Idempotency-Key': crypto.randomUUID(),
  });

  try {
    if (action === 'preference') {
      const preference = {
        items: [
          {
            id: deliveryId,
            title: `Pedido ${String(deliveryId).slice(0, 8)}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: user.email,
          name: (delivery.customer_name as string) || user.email?.split('@')[0] || 'Cliente',
        },
        external_reference: extRef,
        notification_url: notificationUrl,
        statement_descriptor: 'FASTFOOD',
        metadata: { type: 'delivery', delivery_id: deliveryId },
        back_urls: {
          success: `${returnBase}?mp=success&app=customer&delivery_id=${encodeURIComponent(deliveryId)}`,
          failure: `${returnBase}?mp=failed&app=customer&delivery_id=${encodeURIComponent(deliveryId)}`,
          pending: `${returnBase}?mp=pending&app=customer&delivery_id=${encodeURIComponent(deliveryId)}`,
        },
        auto_return: 'approved',
      };

      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: mpHeaders,
        body: JSON.stringify(preference),
      });

      const prefText = await mpRes.text();
      if (!mpRes.ok) {
        console.error('MP preference error:', prefText);
        return new Response(JSON.stringify({ error: `Mercado Pago: ${prefText}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const prefData = JSON.parse(prefText);
      await admin
        .from('deliveries')
        .update({
          mp_preference_id: prefData.id,
          payment_status: 'awaiting_payment',
          payment_method_label: 'checkout_pro',
        })
        .eq('id', deliveryId);

      return new Response(
        JSON.stringify({
          checkout_url: prefData.init_point,
          sandbox_url: prefData.sandbox_init_point,
          preference_id: prefData.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'pix') {
      const parts = String(delivery.customer_name || '').trim().split(/\s+/);
      const firstName = parts[0] || 'Cliente';
      const lastName = parts.slice(1).join(' ') || firstName;

      const payBody = {
        transaction_amount: amount,
        description: `Pedido ${deliveryId.slice(0, 8)}`,
        payment_method_id: 'pix',
        payer: {
          email: user.email,
          first_name: firstName,
          last_name: lastName,
        },
        external_reference: extRef,
        notification_url: notificationUrl,
        metadata: { delivery_id: deliveryId },
      };

      const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: mpPaymentHeaders(),
        body: JSON.stringify(payBody),
      });

      const payText = await mpRes.text();
      if (!mpRes.ok) {
        console.error('MP PIX error:', payText);
        return new Response(JSON.stringify({ error: `Mercado Pago: ${payText}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pay = JSON.parse(payText);
      const tid = pay.point_of_interaction?.transaction_data;
      const qrBase64 = tid?.qr_code_base64 as string | undefined;
      const qrCode = tid?.qr_code as string | undefined;
      const ticketUrl = tid?.ticket_url as string | undefined;

      await admin
        .from('deliveries')
        .update({
          mp_payment_id: String(pay.id),
          payment_status: pay.status === 'approved' ? 'paid' : 'processing',
          payment_method_label: 'pix',
        })
        .eq('id', deliveryId);

      return new Response(
        JSON.stringify({
          payment_id: pay.id,
          status: pay.status,
          qr_code_base64: qrBase64,
          qr_code: qrCode,
          ticket_url: ticketUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'saved_card') {
      const savedCardId = body.saved_card_id;
      if (!savedCardId) {
        return new Response(JSON.stringify({ error: 'saved_card_id obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: cardRow, error: cErr } = await admin
        .from('customer_mp_cards')
        .select('id, user_id, mercadopago_card_id, payment_method_id')
        .eq('id', savedCardId)
        .single();

      if (cErr || !cardRow || cardRow.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Cartão não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payBody: Record<string, unknown> = {
        transaction_amount: amount,
        token: cardRow.mercadopago_card_id,
        description: `Pedido ${deliveryId.slice(0, 8)}`,
        installments: 1,
        payment_method_id: cardRow.payment_method_id || 'visa',
        payer: { email: user.email },
        external_reference: extRef,
        notification_url: notificationUrl,
        metadata: { delivery_id: deliveryId },
      };

      const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: mpPaymentHeaders(),
        body: JSON.stringify(payBody),
      });

      const payText = await mpRes.text();
      if (!mpRes.ok) {
        console.error('MP card payment error:', payText);
        return new Response(JSON.stringify({ error: `Mercado Pago: ${payText}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pay = JSON.parse(payText);
      const paid = pay.status === 'approved';

      await admin
        .from('deliveries')
        .update({
          mp_payment_id: String(pay.id),
          payment_status: paid ? 'paid' : pay.status === 'pending' || pay.status === 'in_process' ? 'processing' : 'failed',
          payment_method_label: 'card',
        })
        .eq('id', deliveryId);

      return new Response(
        JSON.stringify({
          payment_id: pay.id,
          status: pay.status,
          paid,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('mp-delivery-payment:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
