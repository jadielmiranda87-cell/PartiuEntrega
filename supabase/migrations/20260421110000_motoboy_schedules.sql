-- Tabela de Agendamento de Motoboys
CREATE TABLE IF NOT EXISTS public.motoboy_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motoboy_id uuid NOT NULL REFERENCES public.motoboys (id) ON DELETE CASCADE,
  work_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('matutino', 'vespertino', 'noturno')),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Garante que um motoboy não agende o mesmo turno no mesmo dia duas vezes
  UNIQUE(motoboy_id, work_date, shift)
);

-- RLS
ALTER TABLE public.motoboy_schedules ENABLE ROW LEVEL SECURITY;

-- Motoboy pode ver e gerenciar seus próprios agendamentos
CREATE POLICY "motoboys_manage_own_schedules"
  ON public.motoboy_schedules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.motoboys m
      WHERE m.id = motoboy_id AND m.user_id = auth.uid()
    )
  );

-- Comentários para os turnos
COMMENT ON COLUMN public.motoboy_schedules.shift IS 'matutino: 08-12h, vespertino: 12-18h, noturno: 18-00h';
