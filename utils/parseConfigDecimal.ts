/**
 * Lê valores numéricos do `app_config` (aceita "2.50", "2,50", espaços).
 */
export function parseConfigDecimal(raw: string | undefined | null, fallback: number): number {
  if (raw == null) return fallback;
  const t = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return fallback;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : fallback;
}
