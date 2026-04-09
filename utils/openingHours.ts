import type { DayCode, DaySchedule, WeeklyOpeningHours } from '@/types';

/** Índice = getDay() (0 = domingo). */
const DAY_ORDER: DayCode[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const UI_DAY_ORDER: DayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_LABELS: Record<DayCode, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

function minutesFromMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Se não houver horários cadastrados, considera aberto (compatibilidade). */
export function isBusinessOpenNow(hours: WeeklyOpeningHours | null | undefined): boolean {
  if (!hours || Object.keys(hours).length === 0) return true;

  const d = new Date();
  const key = DAY_ORDER[d.getDay()];
  const sch: DaySchedule | undefined = hours[key];

  if (!sch) return true;

  if (sch.closed) return false;

  const now = d.getHours() * 60 + d.getMinutes();
  const o = minutesFromMidnight(sch.open || '00:00');
  const c = minutesFromMidnight(sch.close || '23:59');

  if (c < o) {
    return now >= o || now < c;
  }
  return now >= o && now < c;
}

export function openingStatusLabel(hours: WeeklyOpeningHours | null | undefined): { open: boolean; label: string } {
  const open = isBusinessOpenNow(hours);
  return {
    open,
    label: open ? 'Aberto agora' : 'Fechado agora',
  };
}

/** Lista ordenada (seg → dom) para exibição na vitrine. */
export function listDaysForDisplay(): { key: DayCode; label: string }[] {
  return UI_DAY_ORDER.map((key) => ({ key, label: DAY_LABELS[key] }));
}

export function formatDayScheduleLine(sch: DaySchedule | undefined): string {
  if (!sch) return '—';
  if (sch.closed) return 'Fechado';
  return `${sch.open} – ${sch.close}`;
}
