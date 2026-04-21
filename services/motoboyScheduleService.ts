import { getSupabaseClient } from '@/template';
import { isAfter, startOfDay, addDays, parseISO } from 'date-fns';

export type Shift = 'matutino' | 'vespertino' | 'noturno';

export interface MotoboySchedule {
  id: string;
  motoboy_id: string;
  work_date: string;
  shift: Shift;
  created_at: string;
  bonus_value: number;
  bonus_paid: boolean;
  online_minutes_count: number;
  is_eligible_for_bonus: boolean;
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

/**
 * Cria um agendamento.
 * Regra: Apenas para datas a partir de amanhã.
 * Regra: Uma vez criado, não pode ser removido (controlado por trigger no banco).
 */
export async function createSchedule(motoboyId: string, date: string, shift: Shift): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();

  const scheduleDate = parseISO(date);
  const tomorrow = startOfDay(addDays(new Date(), 1));

  if (!isAfter(scheduleDate, startOfDay(new Date()))) {
    return { error: 'O agendamento deve ser feito pelo menos para o dia seguinte.' };
  }

  const { error } = await supabase
    .from('motoboy_schedules')
    .insert({
      motoboy_id: motoboyId,
      work_date: date,
      shift: shift,
    });

  if (error) {
    if (error.code === '23505') return { error: 'Este turno já está agendado.' };
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Atualiza o progresso de tempo online do motoboy no turno atual.
 * Chamado pelo rastreamento GPS.
 */
export async function incrementOnlineMinutes(motoboyId: string, shift: Shift): Promise<void> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  // RPC ou Incremento direto
  await supabase.rpc('increment_schedule_online_minutes', {
    m_id: motoboyId,
    w_date: today,
    s_shift: shift
  });
}

/**
 * Busca todos os agendamentos de uma data específica (Admin)
 */
export async function adminGetAllSchedules(date: string): Promise<MotoboySchedule[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('motoboy_schedules')
    .select('*, motoboys(name, phone)')
    .eq('work_date', date)
    .order('shift', { ascending: true });

  if (error) {
    console.error('Error fetching admin schedules:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Aplica um bônus a um agendamento específico (Admin)
 */
export async function adminApplyBonus(scheduleId: string, value: number): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('motoboy_schedules')
    .update({
      bonus_value: value,
      is_eligible_for_bonus: true,
      bonus_paid: true
    })
    .eq('id', scheduleId);

  return { error: error ? error.message : null };
}
