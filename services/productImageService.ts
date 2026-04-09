import { getSupabaseClient } from '@/template';

const BUCKET = 'product-images';

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/**
 * Envia imagem do produto para o Storage. O bucket `product-images` deve existir no Supabase (público leitura).
 */
export async function uploadProductImage(
  businessId: string,
  productId: string,
  fileUri: string,
  contentType: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const ext = contentType.toLowerCase().includes('png') ? 'png' : 'jpg';
  const path = `${businessId}/${productId}.${ext}`;

  try {
    const arrayBuffer = await uriToArrayBuffer(fileUri);
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

    if (error) return { url: null, error: error.message };

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return { url: pub.publicUrl, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao enviar imagem';
    return { url: null, error: msg };
  }
}
