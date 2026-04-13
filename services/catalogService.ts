import { getSupabaseClient } from '@/template';
import type { Product, ProductCategory, Business } from '@/types';

/** Banco remoto sem migração `20260410130000_product_promo_fields.sql` — PostgREST acusa schema cache. */
function isMissingProductPromoColumnsError(message: string): boolean {
  return /compare_price|max_per_order|schema cache/i.test(message);
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single();
  if (error) {
    console.warn('getBusinessById', id, error.message);
    return null;
  }
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

export async function getCategoriesForBusiness(businessId: string): Promise<ProductCategory[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.warn('getCategoriesForBusiness', businessId, error.message);
    return [];
  }
  return data ?? [];
}

export async function getProductsForBusiness(businessId: string): Promise<Product[]> {
  const supabase = getSupabaseClient();
  // Alinhar à política RLS (COALESCE(is_active,true)): null não pode ser excluído por .eq(true) no PostgREST.
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .or('is_active.is.null,is_active.eq.true')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.warn('getProductsForBusiness', businessId, error.message);
    return [];
  }
  return data ?? [];
}

/** Painel do comércio — inclui inativos. */
export async function getAllProductsForBusiness(businessId: string): Promise<Product[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.warn('getAllProductsForBusiness', businessId, error.message);
    return [];
  }
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
