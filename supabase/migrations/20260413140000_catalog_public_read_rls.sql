-- Leitura pública do cardápio para o app cliente (anon + authenticated).
-- Sem política de SELECT ampla, o PostgREST devolve 0 linhas para visitantes e a vitrine fica vazia.
-- Comércio continua podendo inserir/atualizar/remover apenas nas próprias linhas.

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
