-- Coordenadas do endereço do comércio (ordenação por proximidade no app cliente).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.businesses.latitude IS 'Latitude (geocode do endereço; vitrine por distância)';
COMMENT ON COLUMN public.businesses.longitude IS 'Longitude (geocode do endereço; vitrine por distância)';
