-- Preço de referência (riscado) e limite por pedido (opcionais).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compare_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS max_per_order int;

COMMENT ON COLUMN public.products.compare_price IS 'Preço "de" para exibir riscado; venda = price.';
COMMENT ON COLUMN public.products.max_per_order IS 'Máx. unidades por pedido; null = sem limite.';
