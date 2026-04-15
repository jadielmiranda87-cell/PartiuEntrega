import { getSupabaseClient } from '@/template';
import type { Product, ProductCategory, Business } from '@/types';

/** Colunas expostas na vitrine do cliente (evita vazar payment_api_key / user_id). */
const BUSINESS_PUBLIC_SELECT =
  'id, name, phone, address, address_number, complement, neighborhood, city, state, cep, cnpj, opening_hours, created_at, billing_plan, latitude, longitude';

/** Banco remoto sem migração `20260410130000_product_promo_fields.sql` — PostgREST acusa schema cache. */
function isMissingProductPromoColumnsError(message: string): boolean {
  return /compare_price|max_per_order|schema cache/i.test(message);
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_PUBLIC_SELECT)
    .eq('id', id)
    .single();
  if (error) {
    console.warn('[Catalog] getBusinessById', id, error.message, error.code);
    return null;
  }
  return data as Business;
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) {
    console.warn('getProductById', id, error.message);
    return null;
  }
  return data;
}

export async function listBusinessesForExplore(): Promise<Business[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_PUBLIC_SELECT)
    .order('name', { ascending: true });
  if (error) {
    console.warn('[Catalog] listBusinessesForExplore', error.message, error.code);
    return [];
  }
  return (data ?? []) as Business[];
}

/** Produto + loja mínima para vitrine inicial (busca por item, não por cidade). */
export type ExploreProductRow = Product & {
  store: Pick<
    Business,
    'id' | 'name' | 'neighborhood' | 'city' | 'opening_hours' | 'latitude' | 'longitude'
  >;
};

function storePickFromBusiness(b: Business): ExploreProductRow['store'] {
  const lat = b.latitude;
  const lng = b.longitude;
  return {
    id: b.id,
    name: b.name,
    neighborhood: b.neighborhood,
    city: b.city,
    opening_hours: b.opening_hours,
    latitude: typeof lat === 'number' && !Number.isNaN(lat) ? lat : undefined,
    longitude: typeof lng === 'number' && !Number.isNaN(lng) ? lng : undefined,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function distanceKmToStore(row: ExploreProductRow, userLat: number, userLng: number): number {
  const lat = row.store.latitude;
  const lng = row.store.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return Number.POSITIVE_INFINITY;
  }
  return haversineKm(userLat, userLng, lat, lng);
}

/**
 * Ordena resultados da busca por produto: comércios mais próximos do cliente primeiro.
 * Lojas sem coordenadas (ainda não geocodificadas) ficam por último.
 */
export function sortExploreProductSearchByProximity(
  rows: ExploreProductRow[],
  userLat: number | null,
  userLng: number | null
): ExploreProductRow[] {
  if (userLat == null || userLng == null || rows.length <= 1) return rows;
  return [...rows].sort((a, b) => {
    const da = distanceKmToStore(a, userLat, userLng);
    const db = distanceKmToStore(b, userLat, userLng);
    if (da !== db) return da - db;
    const pa = hasPromoPrice(a) ? 1 : 0;
    const pb = hasPromoPrice(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function hasPromoPrice(p: Product): boolean {
  return p.compare_price != null && Number(p.compare_price) > Number(p.price);
}

/** Mistura lojas para o feed não ficar monopolizado por um só comércio. */
function interleaveByBusinessId<T extends { business_id: string }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const arr = buckets.get(item.business_id) ?? [];
    arr.push(item);
    buckets.set(item.business_id, arr);
  }
  const ids = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  const out: T[] = [];
  let round = 0;
  let remaining = items.length;
  while (remaining > 0) {
    for (const bid of ids) {
      const bucket = buckets.get(bid)!;
      if (round < bucket.length) {
        out.push(bucket[round]);
        remaining--;
      }
    }
    round++;
  }
  return out;
}

function rankExploreProducts(rows: ExploreProductRow[]): ExploreProductRow[] {
  const sorted = [...rows].sort((a, b) => {
    const pa = hasPromoPrice(a) ? 1 : 0;
    const pb = hasPromoPrice(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return interleaveByBusinessId(sorted);
}

/**
 * Home do cliente: restaurantes + produtos ativos já na abertura (sem precisar pesquisar).
 * Busca no app deve usar nome/descrição do produto — ver `matchesExploreProductSearch`.
 */
export async function getCustomerExploreHome(options?: { productLimit?: number }): Promise<{
  businesses: Business[];
  products: ExploreProductRow[];
  error: string | null;
}> {
  const limit = options?.productLimit ?? 280;
  const supabase = getSupabaseClient();
  const [bizRes, prodRes] = await Promise.all([
    supabase.from('businesses').select(BUSINESS_PUBLIC_SELECT).order('name', { ascending: true }),
    supabase.from('products').select('*').order('created_at', { ascending: false }).limit(limit),
  ]);

  const errMsg = bizRes.error?.message ?? prodRes.error?.message ?? null;
  if (bizRes.error) {
    console.warn('[Catalog] explore home businesses', bizRes.error.message, bizRes.error.code);
  }
  if (prodRes.error) {
    console.warn('[Catalog] explore home products', prodRes.error.message, prodRes.error.code);
  }

  const businesses = (bizRes.data ?? []) as Business[];
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const raw = prodRes.data ?? [];

  const rows: ExploreProductRow[] = [];
  for (const p of raw) {
    if (!p.is_active) continue;
    const b = bizMap.get(p.business_id);
    if (!b) continue;
    rows.push({
      ...p,
      store: storePickFromBusiness(b),
    });
  }

  return {
    businesses,
    products: rankExploreProducts(rows),
    error: errMsg,
  };
}

/** IDs de lojas cujo nome contém o termo (para busca do cliente pelo comércio). */
export function getBusinessIdsMatchingName(businesses: Pick<Business, 'id' | 'name'>[], q: string): string[] {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  return businesses.filter((b) => b.name.toLowerCase().includes(n)).map((b) => b.id);
}

/**
 * Cardápio completo das lojas indicadas (para busca por nome do comércio — não depende do limite do feed).
 */
export async function getExploreProductsForBusinessIds(
  businessIds: string[],
  businesses: Business[]
): Promise<ExploreProductRow[]> {
  if (businessIds.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('business_id', businessIds)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.warn('[Catalog] getExploreProductsForBusinessIds', error.message, error.code);
    return [];
  }
  const bizMap = new Map(businesses.map((b) => [b.id, b]));
  const rows: ExploreProductRow[] = [];
  for (const p of data ?? []) {
    if (!p.is_active) continue;
    const b = bizMap.get(p.business_id);
    if (!b) continue;
    rows.push({
      ...p,
      store: storePickFromBusiness(b),
    });
  }
  return rankExploreProducts(rows);
}

/** Filtro por nome/descrição do produto (quando a busca não é pelo nome da loja). */
export function matchesExploreProductSearch(row: ExploreProductRow, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if (row.name.toLowerCase().includes(n)) return true;
  if (row.description?.toLowerCase().includes(n)) return true;
  return false;
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
    console.warn('[Catalog] getCategoriesForBusiness', businessId, error.message, error.code);
    return [];
  }
  return data ?? [];
}

export async function getProductsForBusiness(businessId: string): Promise<Product[]> {
  const supabase = getSupabaseClient();
  // Filtro de ativos fica no RLS (`products_select_public_active`). Evita `.or()` com RLS que às vezes retorna 0 linhas no PostgREST.
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.warn('[Catalog] getProductsForBusiness', businessId, error.message, error.code);
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
): Promise<{
  categories: ProductCategory[];
  byCategory: Record<string, Product[]>;
  /** Preenchido quando o Supabase recusa leitura (RLS/GRANT) — o app cliente deve mostrar a mensagem. */
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  const [catRes, prodRes] = await Promise.all([
    supabase
      .from('product_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  const errMsg = catRes.error?.message ?? prodRes.error?.message ?? null;
  if (catRes.error) {
    console.warn('[Catalog] menu categories', businessId, catRes.error.message, catRes.error.code);
  }
  if (prodRes.error) {
    console.warn('[Catalog] menu products', businessId, prodRes.error.message, prodRes.error.code);
  }

  const categories = catRes.data ?? [];
  const products = prodRes.data ?? [];

  const byCategory: Record<string, Product[]> = {};
  for (const c of categories) {
    byCategory[c.id] = [];
  }
  for (const p of products) {
    if (!byCategory[p.category_id]) byCategory[p.category_id] = [];
    byCategory[p.category_id].push(p);
  }
  return { categories, byCategory, error: errMsg };
}
