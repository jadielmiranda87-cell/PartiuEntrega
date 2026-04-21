import { getSupabaseClient } from '@/template';

export type Shift = 'matutino' | 'vespertino' | 'noturno';

export interface MotoboySchedule {
  id: string;
  motoboy_id: string;
  work_date: string;
  shift: Shift;
  created_at: string;
}

export async function getMotoboySchedules(motoboyId: string, startDate: string, endDate: string): Promise<MotoboySchedule[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('motoboy_schedules')
    .select('*')
    .eq('motoboy_id', motoboyId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }
  return data ?? [];
}

export async function toggleSchedule(motoboyId: string, date: string, shift: Shift): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  // Check if already exists
  const { data: existing } = await supabase
    .from('motoboy_schedules')
    .select('id')
    .eq('motoboy_id', motoboyId)
    .eq('work_date', date)
    .eq('shift', shift)
    .maybeSingle();

  if (existing) {
    // Remove if exists
    const { error } = await supabase
      .from('motoboy_schedules')
      .delete()
      .eq('id', existing.id);
    return { error: error ? error.message : null };
  } else {
    // Insert if not exists
    const { error } = await supabase
      .from('motoboy_schedules')
      .insert({
        motoboy_id: motoboyId,
        work_date: date,
        shift: shift,
      });
    return { error: error ? error.message : null };
  }
}
