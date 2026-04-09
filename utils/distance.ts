/** Distância em km entre dois pontos (OSRM). */

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function getOsrmDistanceKm(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  userAgent = 'FastFood/1.0'
): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) return null;
    return Math.round((json.routes[0].distance / 1000) * 10) / 10;
  } catch {
    return null;
  }
}
