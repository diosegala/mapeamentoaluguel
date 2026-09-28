CREATE TABLE public.secoes_formulario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secoes_formulario TO authenticated;
GRANT USAGE ON SEQUENCE public.secoes_formulario_numero_seq TO authenticated;
GRANT ALL ON public.secoes_formulario TO service_role;
GRANT ALL ON SEQUENCE public.secoes_formulario_numero_seq TO service_role;
ALTER TABLE public.secoes_formulario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage secoes" ON public.secoes_formulario FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_secoes_updated BEFORE UPDATE ON public.secoes_formulario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.secoes_formulario (numero, nome) VALUES
 (1,'Perfil da imobiliária'),(2,'Pessoas'),(3,'Processos'),(4,'Tecnologia'),(5,'Uso de IA'),(6,'Indicadores');
SELECT setval('public.secoes_formulario_numero_seq', 6);