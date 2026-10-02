-- Revisão humana antes do envio ao cliente e fila de geração no servidor.

ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS conteudo_ia text,
  ADD COLUMN IF NOT EXISTS publicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS nota_revisao text,
  ADD COLUMN IF NOT EXISTS processando_desde timestamptz;

-- Versões já concluídas continuam visíveis para os clientes.
UPDATE public.relatorios
SET publicado_em = created_at, conteudo_ia = coalesce(conteudo_ia, conteudo)
WHERE status = 'concluido' AND publicado_em IS NULL;

CREATE INDEX IF NOT EXISTS relatorios_fila_idx ON public.relatorios (created_at) WHERE status = 'gerando';

-- Revisão humana ligada: nada chega ao cliente sem aprovação, até um admin mudar o modo.
ALTER TABLE public.configuracao_email ADD COLUMN IF NOT EXISTS emails_revisao text NOT NULL DEFAULT '';
UPDATE public.configuracao_email SET envio_automatico = false;
ALTER TABLE public.configuracao_email ALTER COLUMN envio_automatico SET DEFAULT false;

-- Fila: o pg_cron chama a rota do app enquanto houver relatório pendente.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'FILA_TOKEN') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'FILA_TOKEN',
      'Token da fila de relatórios (pg_cron -> /api/fila-relatorios)'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.disparar_fila_relatorios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  -- Só chama o app quando há relatório pendente ou com geração interrompida há mais de 12 minutos.
  IF NOT EXISTS (
    SELECT 1 FROM public.relatorios
    WHERE status = 'gerando'
      AND (processando_desde IS NULL OR processando_desde < now() - interval '12 minutes')
  ) THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'FILA_TOKEN';
  PERFORM net.http_post(
    url := 'https://mapeamentoaluguel.lovable.app/api/fila-relatorios',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-fila-token', v_token),
    timeout_milliseconds := 600000
  );
END;
$$;

REVOKE ALL ON FUNCTION private.disparar_fila_relatorios() FROM public, anon, authenticated;

-- Agendamento (aplicado depois do deploy da rota):
-- SELECT cron.schedule('fila-relatorios', '* * * * *', 'SELECT private.disparar_fila_relatorios()');
