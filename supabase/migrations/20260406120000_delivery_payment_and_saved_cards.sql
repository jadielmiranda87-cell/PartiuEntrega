-- Pagamento de pedidos (app cliente) + cartões salvos (Mercado Pago).

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'n/a';

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS mp_payment_id text;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS mp_preference_id text;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_method_label text;

COMMENT ON COLUMN public.deliveries.payment_status IS
  'n/a = manual/offline | awaiting_payment | processing | paid | failed';
COMMENT ON COLUMN public.deliveries.payment_method_label IS 'pix | card | checkout_pro (informativo)';

CREATE TABLE IF NOT EXISTS public.customer_mp_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mercadopago_customer_id text,
  mercadopago_card_id text NOT NULL,
  last_four_digits text,
  payment_method_id text,
  cardholder_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mercadopago_card_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_mp_cards_user ON public.customer_mp_cards (user_id);

ALTER TABLE public.customer_mp_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_mp_cards_select_own"
  ON public.customer_mp_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "customer_mp_cards_delete_own"
  ON public.customer_mp_cards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.customer_mp_cards IS
  'Referências de cartão Mercado Pago (sem PAN/CVV). Preenchido pelo webhook após pagamento aprovado.';
