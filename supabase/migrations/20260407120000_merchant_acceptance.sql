-- Confirmação do comércio em pedidos do app (após pagamento) + estorno em recusa.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS merchant_acceptance text;

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_merchant_acceptance_check;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_merchant_acceptance_check
  CHECK (
    merchant_acceptance IS NULL
    OR merchant_acceptance IN ('pending', 'accepted', 'rejected')
  );

COMMENT ON COLUMN public.deliveries.merchant_acceptance IS
  'Pedidos app: após pagamento aprovado = pending até aceitar/recusar; null em pedidos manuais ou antes do pagamento.';

COMMENT ON COLUMN public.deliveries.payment_status IS
  'n/a | awaiting_payment | processing | paid | failed | refunded';
