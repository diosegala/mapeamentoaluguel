-- A fila passa a chamar o domínio próprio do app (o endereço lovable.app redireciona e o pg_net não segue redirecionamentos).
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
