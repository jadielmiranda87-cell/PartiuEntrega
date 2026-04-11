-- Coordenadas do ponto de entrega (GPS ou geocoding do endereço).

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_lat double precision;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;

COMMENT ON COLUMN public.deliveries.delivery_lat IS 'Latitude do endereço de entrega (opcional).';
COMMENT ON COLUMN public.deliveries.delivery_lng IS 'Longitude do endereço de entrega (opcional).';
