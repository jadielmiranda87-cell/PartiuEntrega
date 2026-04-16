-- =============================================================================
-- apply_deliveries_rls.sql
-- Configura RLS na tabela deliveries:
--   • Cliente autenticado cria pedido pelo app (order_source = 'app')
--   • Comércio cria entrega manual e vê/atualiza os próprios pedidos
--   • Motoboy vê a fila de pedidos pendentes e atualiza corridas atribuídas
--   • Admin vê e atualiza tudo
-- Idempotente: DROP POLICY IF EXISTS antes de recriar.
-- =============================================================================

-- Garantir acesso à tabela para o papel authenticated.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;

-- Ativar RLS (idempotente se já estava ativo).
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- POLÍTICA: cliente cria pedido pelo app
-- =============================================================================
DROP POLICY IF EXISTS "delivery_customer_insert_own" ON public.deliveries;
CREATE POLICY "delivery_customer_insert_own"
  ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    order_source = 'app'
    AND customer_user_id = auth.uid()
  );

-- =============================================================================
-- POLÍTICA: cliente lê os próprios pedidos
-- =============================================================================
DROP POLICY IF EXISTS "delivery_customer_select_own" ON public.deliveries;
CREATE POLICY "delivery_customer_select_own"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
  );

-- =============================================================================
-- POLÍTICA: comércio cria entrega manual
-- =============================================================================
DROP POLICY IF EXISTS "delivery_insert_business" ON public.deliveries;
CREATE POLICY "delivery_insert_business"
  ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- POLÍTICA: comércio lê os próprios pedidos/entregas
-- =============================================================================
DROP POLICY IF EXISTS "delivery_business_select_own" ON public.deliveries;
CREATE POLICY "delivery_business_select_own"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- POLÍTICA: comércio atualiza os próprios pedidos
-- =============================================================================
DROP POLICY IF EXISTS "delivery_business_update_own" ON public.deliveries;
CREATE POLICY "delivery_business_update_own"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- POLÍTICA: motoboy vê pedidos pendentes (fila) + corridas atribuídas a ele
-- =============================================================================
DROP POLICY IF EXISTS "delivery_motoboy_select" ON public.deliveries;
CREATE POLICY "delivery_motoboy_select"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    (
      -- Corridas em aberto visíveis para qualquer motoboy cadastrado
      status = 'pending'
      AND (
        SELECT user_type FROM public.user_profiles WHERE id = auth.uid()
      ) = 'motoboy'
    )
    OR
    -- Corrida já atribuída a este motoboy
    motoboy_id IN (
      SELECT id FROM public.motoboys WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- POLÍTICA: motoboy atualiza corrida atribuída a ele (aceitar/coletar/entregar)
-- =============================================================================
DROP POLICY IF EXISTS "delivery_motoboy_update_assigned" ON public.deliveries;
CREATE POLICY "delivery_motoboy_update_assigned"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    (
      -- Pode aceitar pedido pendente (auto-atribuição)
      status = 'pending'
      AND (
        SELECT user_type FROM public.user_profiles WHERE id = auth.uid()
      ) = 'motoboy'
    )
    OR
    -- Pode atualizar corrida já atribuída
    motoboy_id IN (
      SELECT id FROM public.motoboys WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- POLÍTICA: admin vê todos os pedidos
-- =============================================================================
DROP POLICY IF EXISTS "delivery_admin_select_all" ON public.deliveries;
CREATE POLICY "delivery_admin_select_all"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    (
      SELECT user_type FROM public.user_profiles WHERE id = auth.uid()
    ) = 'admin'
  );

-- =============================================================================
-- POLÍTICA: admin atualiza qualquer pedido
-- =============================================================================
DROP POLICY IF EXISTS "delivery_admin_update_all" ON public.deliveries;
CREATE POLICY "delivery_admin_update_all"
  ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING (
    (
      SELECT user_type FROM public.user_profiles WHERE id = auth.uid()
    ) = 'admin'
  );
