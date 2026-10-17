-- Relatório consolidado para a liderança da CUPOLA (leitura de mercado). Só admins; sem acesso anônimo.
CREATE TABLE public.relatorios_mercado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao integer NOT NULL,
  status text NOT NULL DEFAULT 'gerando' CHECK (status IN ('gerando', 'concluido', 'erro')),
  conteudo text,
  erro text,
  base text NOT NULL DEFAULT '',
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosticos_incluidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo jsonb,
  modelo text,
  tokens_entrada integer,
  tokens_saida integer,
  tokens_cache_criacao integer,
  tokens_cache_leitura integer,
  processando_desde timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_mercado TO authenticated;
GRANT ALL ON public.relatorios_mercado TO service_role;
ALTER TABLE public.relatorios_mercado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage relatorios_mercado" ON public.relatorios_mercado
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_relatorios_mercado_updated BEFORE UPDATE ON public.relatorios_mercado
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A fila também dispara quando há relatório de mercado pendente.
CREATE OR REPLACE FUNCTION private.disparar_fila_relatorios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.relatorios
    WHERE status = 'gerando'
      AND (processando_desde IS NULL OR processando_desde < now() - interval '12 minutes')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.relatorios_mercado
    WHERE status = 'gerando'
      AND (processando_desde IS NULL OR processando_desde < now() - interval '12 minutes')
  ) THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'FILA_TOKEN';
  PERFORM net.http_post(
    url := 'https://mapeamentoaluguel.cupola.com.br/api/fila-relatorios',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-fila-token', v_token),
    timeout_milliseconds := 600000
  );
END;
$$;

REVOKE ALL ON FUNCTION private.disparar_fila_relatorios() FROM public, anon, authenticated;
