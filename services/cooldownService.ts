/**
 * cooldownService.ts
 *
 * Manages motoboy cooldowns:
 *  - "accept"  cooldown: global, set after a motoboy accepts any ride
 *  - "refuse"  cooldown: per-business, progressive based on refusal count
 *
 * Cooldown durations come from app_config:
 *   accept_cooldown_minutes   → e.g. "30"
 *   refuse_cooldown_rules     → JSON e.g. '[{"count":1,"minutes":15},{"count":2,"minutes":60},{"count":3,"minutes":360}]'
 */

import { getSupabaseClient } from '@/template';

export interface RefuseCooldownRule {
  count: number;    // number of refusals this rule applies to
  minutes: number;  // minutes of cooldown for this refusal count
}

// ── Set cooldown after accepting a ride ───────────────────────────────────────
export async function setAcceptCooldown(
  motoboyId: string,
  cooldownMinutes: number
): Promise<void> {
  if (cooldownMinutes <= 0) return;
  const supabase = getSupabaseClient();
  const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60_000).toISOString();

  // Upsert: one accept-cooldown row per motoboy (unique index enforces this)
  await supabase.from('motoboy_cooldowns').upsert(
    {
      motoboy_id: motoboyId,
      business_id: null,
      cooldown_type: 'accept',
      cooldown_until: cooldownUntil,
      refusal_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'motoboy_id', ignoreDuplicates: false }
  );
}

// ── Set / increment refuse cooldown for a specific business ──────────────────
export async function setRefuseCooldown(
  motoboyId: string,
  businessId: string,
  rules: RefuseCooldownRule[]
): Promise<{ refusalCount: number; cooldownMinutes: number }> {
  const supabase = getSupabaseClient();

  // Fetch existing row for this motoboy+business pair
  const { data: existing } = await supabase
    .from('motoboy_cooldowns')
    .select('id, refusal_count')
    .eq('motoboy_id', motoboyId)
    .eq('business_id', businessId)
    .eq('cooldown_type', 'refuse')
    .maybeSingle();

  const newCount = (existing?.refusal_count ?? 0) + 1;

  // Find the matching rule (last rule applies for all higher counts)
  const sortedRules = [...rules].sort((a, b) => b.count - a.count);
  const matchingRule = sortedRules.find((r) => newCount >= r.count) ?? sortedRules[sortedRules.length - 1];
  const cooldownMinutes = matchingRule?.minutes ?? 15;

  const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60_000).toISOString();

  if (existing) {
    await supabase
      .from('motoboy_cooldowns')
      .update({
        refusal_count: newCount,
        cooldown_until: cooldownUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('motoboy_cooldowns').insert({
      motoboy_id: motoboyId,
      business_id: businessId,
      cooldown_type: 'refuse',
      cooldown_until: cooldownUntil,
      refusal_count: newCount,
    });
  }

  return { refusalCount: newCount, cooldownMinutes };
}

// ── Get active cooldowns for a motoboy ────────────────────────────────────────
export interface ActiveCooldown {
  type: 'accept' | 'refuse';
  businessId: string | null;
  cooldownUntil: string;
  refusalCount: number;
}

export async function getActiveCooldowns(motoboyId: string): Promise<ActiveCooldown[]> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('motoboy_cooldowns')
    .select('cooldown_type, business_id, cooldown_until, refusal_count')
    .eq('motoboy_id', motoboyId)
    .gt('cooldown_until', now);

  return (data ?? []).map((row) => ({
    type: row.cooldown_type as 'accept' | 'refuse',
    businessId: row.business_id,
    cooldownUntil: row.cooldown_until,
    refusalCount: row.refusal_count,
  }));
}

// ── Check if motoboy is globally blocked (after accept) ──────────────────────
export async function isInAcceptCooldown(motoboyId: string): Promise<{ blocked: boolean; until: string | null }> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('motoboy_cooldowns')
    .select('cooldown_until')
    .eq('motoboy_id', motoboyId)
    .eq('cooldown_type', 'accept')
    .is('business_id', null)
    .gt('cooldown_until', now)
    .maybeSingle();

  return { blocked: !!data, until: data?.cooldown_until ?? null };
}

// ── Parse refuse cooldown rules from config string ───────────────────────────
export function parseRefuseCooldownRules(raw: string): RefuseCooldownRule[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as RefuseCooldownRule[];
  } catch { /* ignore */ }
  return [{ count: 1, minutes: 15 }, { count: 2, minutes: 60 }, { count: 3, minutes: 360 }];
}

// ── Format remaining cooldown time as readable string ────────────────────────
export function formatCooldownRemaining(until: string): string {
  const remaining = new Date(until).getTime() - Date.now();
  if (remaining <= 0) return '';
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
