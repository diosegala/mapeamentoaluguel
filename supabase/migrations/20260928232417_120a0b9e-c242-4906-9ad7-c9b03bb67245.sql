CREATE TABLE public.auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES public.diagnosticos(id) ON DELETE CASCADE,
  relatorio_id uuid REFERENCES public.relatorios(id) ON DELETE SET NULL,
  modelo text NOT NULL,
  tokens_entrada integer NOT NULL DEFAULT 0,
  tokens_saida integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auditorias TO authenticated;
GRANT ALL ON public.auditorias TO service_role;
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem auditorias" ON public.auditorias FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));