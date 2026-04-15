-- Leitura da vitrine (lista + detalhe do restaurante) no app cliente.
-- Escrita continua só para o dono (user_id = auth.uid()).

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses_select_public" ON public.businesses;
CREATE POLICY "businesses_select_public"
  ON public.businesses
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "businesses_owner_manage" ON public.businesses;
CREATE POLICY "businesses_owner_manage"
  ON public.businesses
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
