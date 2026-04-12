import { getSupabaseClient } from '@/template';
import type { Product, ProductCategory, Business } from '@/types';

/** Banco remoto sem migração `20260410130000_product_promo_fields.sql` — PostgREST acusa schema cache. */
function isMissingProductPromoColumnsError(message: string): boolean {
  return /compare_price|max_per_order|schema cache/i.test(message);
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function listBusinessesForExplore(): Promise<Business[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    console.warn('listBusinessesForExplore', error.message);
    return [];
  }
  return data ?? [];
}

export type ExploreBusinessRow = Business & {
  menu_item_count: number;
  menu_preview_names: string[];
  /** Nomes de categorias do cardápio deste comércio (filtros na vitrine). */
  category_names: string[];
};

export type ExploreProductHighlight = {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  price: number;
  image_url: string | null;
};

/** Restaurantes com contagem e amostra de itens do cardápio (vitrine inicial). */
export async function listBusinessesExploreEnriched(): Promise<ExploreBusinessRow[]> {
  const businesses = await listBusinessesForExplore();
  if (businesses.length === 0) return [];
  const ids = businesses.map((b) => b.id);
  const supabase = getSupabaseClient();
  const [{ data: products }, { data: catRows }] = await Promise.all([
    supabase
      .from('products')
      .select('business_id, name')
      .eq('is_active', true)
      .in('business_id', ids),
    supabase.from('product_categories').select('business_id, name').in('business_id', ids),
  ]);
  const byBiz = new Map<string, string[]>();
  for (const p of products ?? []) {
    const bid = p.business_id as string;
    const arr = byBiz.get(bid) ?? [];
    arr.push(String(p.name));
    byBiz.set(bid, arr);
  }
  const catByBiz = new Map<string, Set<string>>();
  for (const c of catRows ?? []) {
    const bid = c.business_id as string;
    if (!catByBiz.has(bid)) catByBiz.set(bid, new Set());
    catByBiz.get(bid)!.add(String(c.name));
  }
  return businesses.map((b) => {
    const names = byBiz.get(b.id) ?? [];
    const cats = catByBiz.get(b.id);
    return {
      ...b,
      menu_item_count: names.length,
      menu_preview_names: names.slice(0, 3),
      category_names: cats ? [...cats].sort((a, x) => a.localeCompare(x, 'pt-BR')) : [],
    };
  });
}

/** Produtos ativos para carrossel “em destaque” (prioriza quem tem foto). */
export async function listExploreHighlightProducts(limit = 12): Promise<ExploreProductHighlight[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, business_id, name, price, image_url, businesses(name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(48);
  if (error) {
    console.warn('listExploreHighlightProducts', error.message);
    return [];
  }
  const rows = [...(data ?? [])].sort((a, b) => {
    const ai = a.image_url ? 1 : 0;
    const bi = b.image_url ? 1 : 0;
    return bi - ai;
  });
  const out: ExploreProductHighlight[] = [];
  for (const r of rows) {
    const biz = (r as { businesses?: { name?: string } | null }).businesses;
    const business_name = biz?.name ? String(biz.name) : '';
    if (!business_name) continue;
    out.push({
      id: r.id as string,
      business_id: r.business_id as string,
      business_name,
      name: String(r.name),
      price: Number(r.price),
      image_url: r.image_url != null ? String(r.image_url) : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getCategoriesForBusiness(businessId: string): Promise<ProductCategory[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('product_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return data ?? [];
}

export async function getProductsForBusiness(businessId: string): Promise<Product[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return data ?? [];
}

/** Painel do comércio — inclui inativos. */
export async function getAllProductsForBusiness(businessId: string): Promise<Product[]> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return data ?? [];
}

export async function createCategory(
  businessId: string,
  name: string,
  sortOrder = 0
): Promise<{ data: ProductCategory | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('product_categories')
    .insert({ business_id: businessId, name: name.trim(), sort_order: sortOrder })
    .select()
    .single();
  return { data, error: error ? error.message : null };
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<ProductCategory, 'name' | 'sort_order'>>
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('product_categories').update(patch).eq('id', id);
  return { error: error ? error.message : null };
}

export async function deleteCategory(id: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('product_categories').delete().eq('id', id);
  return { error: error ? error.message : null };
}

export async function createProduct(
  row: Omit<Product, 'id' | 'created_at'>
): Promise<{ data: Product | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const base = {
    business_id: row.business_id,
    category_id: row.category_id,
    name: row.name.trim(),
    description: row.description?.trim() || null,
    price: row.price,
    image_url: row.image_url || null,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
  const withPromo = {
    ...base,
    compare_price: row.compare_price ?? null,
    max_per_order: row.max_per_order ?? null,
  };
  let { data, error } = await supabase.from('products').insert(withPromo).select().single();
  if (error && isMissingProductPromoColumnsError(error.message)) {
    ({ data, error } = await supabase.from('products').insert(base).select().single());
  }
  return { data, error: error ? error.message : null };
}

export async function getProductById(productId: string): Promise<Product | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
  if (error) return null;
  return (data as Product) ?? null;
}

export async function updateProduct(
  id: string,
  patch: Partial<
    Pick<
      Product,
      | 'name'
      | 'description'
      | 'price'
      | 'compare_price'
      | 'max_per_order'
      | 'image_url'
      | 'is_active'
      | 'sort_order'
      | 'category_id'
    >
  >
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  let { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error && isMissingProductPromoColumnsError(error.message)) {
    const { compare_price: _cp, max_per_order: _mo, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      ({ error } = await supabase.from('products').update(rest).eq('id', id));
    } else {
      return {
        error:
          'O banco ainda não tem as colunas compare_price / max_per_order. Rode o SQL em supabase/migrations/20260410130000_product_promo_fields.sql no painel do Supabase.',
      };
    }
  }
  return { error: error ? error.message : null };
}

export async function deleteProduct(id: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error: error ? error.message : null };
}

/** Produtos agrupados por categoria (para a vitrine). */
export async function getMenuForBusiness(
  businessId: string
): Promise<{ categories: ProductCategory[]; byCategory: Record<string, Product[]> }> {
  const [categories, products] = await Promise.all([
    getCategoriesForBusiness(businessId),
    getProductsForBusiness(businessId),
  ]);
  const byCategory: Record<string, Product[]> = {};
  for (const c of categories) {
    byCategory[c.id] = [];
  }
  for (const p of products) {
    if (!byCategory[p.category_id]) byCategory[p.category_id] = [];
    byCategory[p.category_id].push(p);
  }
  return { categories, byCategory };
}
