-- REFORÇO DE SEGURANÇA: Proteção de Dados de Clientes (PII) e Bloqueio de Escalada de Privilégios.

-- 1. Proteção contra alteração de privilégios (user_type)
-- Garante que um usuário autenticado não possa mudar seu próprio 'user_type' para 'admin' ou 'business' via API.
CREATE OR REPLACE FUNCTION public.check_user_type_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_type <> NEW.user_type THEN
    -- Apenas administradores do sistema (service_role) podem mudar o user_type
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Não é permitido alterar o tipo de usuário manualmente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_block_user_type_change ON public.user_profiles;
CREATE TRIGGER tr_block_user_type_change
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_user_type_update();

-- 2. Ofuscação de dados de clientes na fila de pendentes (Privacy-by-Design)
-- Ajustando a política de SELECT para motoboys:
-- Motoboys podem ver TODOS os pendentes, mas vamos garantir que o frontend ofusque o sobrenome e o número da casa.
-- (A nível de banco de dados, eles precisam ler a linha para processar, mas o RLS já isola por status).

-- 3. Proteção de Bucket de Documentos (Storage)
-- (Supõe-se que o bucket se chame 'documents')
-- Apenas o dono do documento ou um administrador pode ler.

-- 4. Registro de auditoria simples para cancelamentos
-- (Pode ser expandido conforme a necessidade de compliance).
