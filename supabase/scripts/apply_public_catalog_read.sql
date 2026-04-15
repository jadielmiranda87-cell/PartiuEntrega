-- Execute no SQL Editor do Supabase / OnSpace (produção) se o app cliente não listar restaurantes ou cardápio.
-- Idempotente: pode rodar mais de uma vez.

-- Garantir privilégios de leitura para o papel anon (chave publicada no app).
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.businesses TO anon, authenticated;
GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;

-- Cardápio: leitura pública + dono gerencia
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_select_public" ON public.product_categories;
CREATE POLICY "product_categories_select_public"
  ON public.product_categories
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "product_categories_business_manage" ON public.product_categories;
CREATE POLICY "product_categories_business_manage"
  ON public.product_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = product_categories.business_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = product_categories.business_id AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_select_public_active" ON public.products;
CREATE POLICY "products_select_public_active"
  ON public.products
  FOR SELECT
  TO public
  USING (COALESCE(is_active, true) = true);

DROP POLICY IF EXISTS "products_business_manage" ON public.products;
CREATE POLICY "products_business_manage"
  ON public.products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = products.business_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = products.business_id AND b.user_id = auth.uid()
    )
  );

-- Vitrine: listar restaurantes
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

-- Ordenação por proximidade no app cliente (geocode ao salvar o comércio)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
