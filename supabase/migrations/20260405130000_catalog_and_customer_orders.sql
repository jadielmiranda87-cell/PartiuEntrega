-- Cardápio + pedidos pelo app (cliente). Executar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_business ON public.product_categories (business_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON public.products (business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS order_subtotal numeric(12, 2);

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS order_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'manual'
    CHECK (order_source IN ('manual', 'app'));

COMMENT ON COLUMN public.deliveries.order_items IS 'Itens do cardápio: [{product_id,name,quantity,unit_price}]';
COMMENT ON COLUMN public.deliveries.order_source IS 'manual = comércio digitou; app = cliente pelo app';
