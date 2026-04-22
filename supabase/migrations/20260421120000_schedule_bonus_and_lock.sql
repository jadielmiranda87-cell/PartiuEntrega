-- Reforço de Agendamento: Imutabilidade e Bonificação

-- Adiciona colunas para controle de bonificação na tabela de agendamentos
ALTER TABLE public.motoboy_schedules
  ADD COLUMN IF NOT EXISTS bonus_value numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_minutes_count int DEFAULT 0, -- Minutos que ficou online no turno
  ADD COLUMN IF NOT EXISTS is_eligible_for_bonus boolean DEFAULT false;

-- Configuração Global de Bônus (pode ser editada pelo admin no app_config)
-- (Já existe a tabela app_config, vamos apenas garantir que os campos existam)

-- Trigger para impedir exclusão ou alteração de agendamentos após criados
CREATE OR REPLACE FUNCTION public.block_schedule_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for um motoboy tentando apagar ou mudar, bloqueia
  IF auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'Agendamentos não podem ser alterados ou removidos após confirmados.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_block_schedule_delete ON public.motoboy_schedules;
CREATE TRIGGER tr_block_schedule_delete
  BEFORE DELETE OR UPDATE ON public.motoboy_schedules
  FOR EACH ROW EXECUTE FUNCTION public.block_schedule_modification();

-- Comentários
COMMENT ON COLUMN public.motoboy_schedules.online_minutes_count IS 'Contagem de minutos que o motoboy enviou sinal de GPS durante o turno';

-- Função RPC para incrementar minutos online com segurança
CREATE OR REPLACE FUNCTION public.increment_schedule_online_minutes(m_id uuid, w_date date, s_shift text)
RETURNS void AS $$
BEGIN
  UPDATE public.motoboy_schedules
  SET online_minutes_count = online_minutes_count + 1
  WHERE motoboy_id = m_id
    AND work_date = w_date
    AND shift = s_shift;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
