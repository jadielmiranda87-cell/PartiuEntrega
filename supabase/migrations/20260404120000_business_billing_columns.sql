-- Executar no SQL Editor do Supabase (ou supabase db push) se ainda não existirem.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS billing_plan text DEFAULT 'basic'
    CHECK (billing_plan IS NULL OR billing_plan IN ('basic', 'delivery'));

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS payment_api_key text;

COMMENT ON COLUMN public.businesses.billing_plan IS 'basic = entrega própria; delivery = usa entregadores da plataforma';
COMMENT ON COLUMN public.businesses.payment_api_key IS 'Token/chave API do gateway do estabelecimento para repasses (tratar como segredo)';

-- Opcional: criar linha billing_config em app_config pelo painel admin no app (ou SQL manual).
