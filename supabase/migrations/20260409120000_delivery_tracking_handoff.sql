-- Rastreamento do motoboy no mapa do cliente + código numérico de entrega na retirada.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS motoboy_lat double precision;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS motoboy_lng double precision;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS motoboy_location_at timestamptz;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS handoff_code text;

COMMENT ON COLUMN public.deliveries.motoboy_lat IS 'Última latitude reportada pelo app do entregador (corrida ativa).';
COMMENT ON COLUMN public.deliveries.motoboy_lng IS 'Última longitude reportada pelo app do entregador.';
COMMENT ON COLUMN public.deliveries.handoff_code IS 'Código numérico mostrado ao cliente após coleta; informado pelo entregador ao finalizar.';
