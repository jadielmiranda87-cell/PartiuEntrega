-- Horários de funcionamento do comércio.
-- Storage: criar bucket público `product-images` no Dashboard (Storage) para fotos de produto.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;

COMMENT ON COLUMN public.businesses.opening_hours IS
  'Horário semanal: { "mon": { "closed": false, "open": "09:00", "close": "22:00" }, ... }';
