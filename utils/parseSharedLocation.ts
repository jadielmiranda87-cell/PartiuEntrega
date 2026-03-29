/**
 * Extrai latitude/longitude de texto colado (link do Google Maps, geo:, WhatsApp, coordenadas soltas).
 */

const UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function parsePair(latStr: string, lngStr: string): { lat: number; lng: number } | null {
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Segue redirects de links curtos (maps.app.goo.gl etc.) para obter a URL final com coordenadas. */
export async function expandShortMapUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  const host = (() => {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const shortHosts = ['goo.gl', 'maps.app.goo.gl', 'bit.ly', 'tinyurl.com'];
  const isShort = shortHosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!isShort) return trimmed;
  try {
    const res = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    return res.url || trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Procura par lat,lng em string (URL decodificada ou texto).
 */
export function extractLatLngFromText(raw: string): { lat: number; lng: number } | null {
  let text = raw.replace(/\+/g, ' ').trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    /* mantém texto original se % estiver inválido */
  }
  if (!text) return null;

  // geo:-23.5,-46.6 ou geo:0,0?q=-23.5,-46.6
  const geo = text.match(/geo:\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (geo) {
    const p = parsePair(geo[1], geo[2]);
    if (p) return p;
  }

  // q=loc:-23.5,-46.6 (comum em links do Maps mobile)
  const loc = text.match(/[?&]q=loc:\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i) || text.match(/q=loc:(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (loc) {
    const p = parsePair(loc[1], loc[2]);
    if (p) return p;
  }

  // /maps/@-23.5,-46.6,17z ou /@-23.5,-46.6
  const at = text.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)(?:,|\s|\/|$|z)/);
  if (at) {
    const p = parsePair(at[1], at[2]);
    if (p) return p;
  }

  // ll=-23.5,-46.6
  const ll = text.match(/[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (ll) {
    const p = parsePair(ll[1], ll[2]);
    if (p) return p;
  }

  // center=-23.5,-46.6
  const center = text.match(/[?&]center=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (center) {
    const p = parsePair(center[1], center[2]);
    if (p) return p;
  }

  // ?q=-23.5,-46.6 (só coordenadas no parâmetro q)
  const qParams = text.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)(?:&|$)/i);
  if (qParams) {
    const p = parsePair(qParams[1], qParams[2]);
    if (p) return p;
  }

  // Coordenadas soltas no texto (ex.: colado do Maps com 2+ casas decimais)
  const loose = text.match(/(-?\d{1,2}\.\d{2,})\s*,\s*(-?\d{1,3}\.\d{2,})/);
  if (loose) {
    const p = parsePair(loose[1], loose[2]);
    if (p) return p;
  }

  return null;
}

export async function resolveLatLngFromClipboardText(raw: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let blob = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    blob = await expandShortMapUrl(trimmed);
  }

  let coords = extractLatLngFromText(blob);
  if (coords) return coords;

  // Tenta extrair de cada linha (WhatsApp às vezes cola texto + URL)
  for (const line of trimmed.split(/[\r\n]+/)) {
    const expanded = /^https?:\/\//i.test(line) ? await expandShortMapUrl(line) : line;
    coords = extractLatLngFromText(expanded);
    if (coords) return coords;
  }

  return null;
}
