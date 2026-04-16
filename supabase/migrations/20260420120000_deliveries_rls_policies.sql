-- RLS em deliveries: app cliente (INSERT pedido), comércio (INSERT manual + SELECT/UPDATE próprios),
-- motoboy (pool pending + corridas atribuídas), admin (SELECT tudo).
-- Idempotente: rode no SQL Editor se o erro for "violates row-level security policy" ao confirmar pedido.

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;

-- Remover políticas antigas com os mesmos nomes (reaplicar sem conflito)
DROP POLICY IF EXISTS "deliveries_insert_customer_app" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_insert_business_manual" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_customer_own" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_business_own" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_motoboy" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_admin" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_update_business_owner" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_update_motoboy" ON public.deliveries;

-- Cliente: criar pedido pelo app (checkout)
CREATE POLICY "deliveries_insert_customer_app"
  ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
    AND COALESCE(order_source, 'app') = 'app'
    AND motoboy_id IS NULL
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id)
  );

-- Comércio: criar entrega manual (Nova Entrega)
CREATE POLICY "deliveries_insert_business_manual"
  ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.user_id = auth.uid()
    )
    AND COALESCE(order_source, 'manual') = 'manual'
    AND customer_user_id IS NULL
  );

-- Cliente: ver próprios pedidos
CREATE POLICY "deliveries_select_customer_own"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

-- Comércio: ver pedidos da própria loja
CREATE POLICY "deliveries_select_business_own"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.user_id = auth.uid()
    )
  );

-- Motoboy: fila pendente + corridas atribuídas a ele
CREATE POLICY "deliveries_select_motoboy"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.motoboys m
      WHERE m.user_id = auth.uid()
      AND (
        (deliveries.status = 'pending' AND deliveries.motoboy_id IS NULL)
        OR deliveries.motoboy_id = m.id
      )
    )
  );

-- Admin: painel (requer user_profiles.user_type = 'admin')
CREATE POLICY "deliveries_select_admin"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.user_type = 'admin'
    )
  );

-- Comércio: atualizar pedidos (ex.: cancelar no painel)
CREATE POLICY "deliveries_update_business_owner"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.user_id = auth.uid()
    )
  );

-- Motoboy: aceitar (pending → assigned), coletar, entregar, devolver à fila
CREATE POLICY "deliveries_update_motoboy"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.motoboys m
      WHERE m.user_id = auth.uid()
      AND (
        deliveries.motoboy_id = m.id
        OR (deliveries.status = 'pending' AND deliveries.motoboy_id IS NULL)
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.motoboys m WHERE m.user_id = auth.uid())
  );
