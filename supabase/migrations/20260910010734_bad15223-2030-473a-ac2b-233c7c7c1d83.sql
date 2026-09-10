
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY "Admins manage diagnosticos" ON public.diagnosticos;
CREATE POLICY "Admins manage diagnosticos" ON public.diagnosticos
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins manage relatorios" ON public.relatorios;
CREATE POLICY "Admins manage relatorios" ON public.relatorios
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins manage base_conhecimento" ON public.base_conhecimento;
CREATE POLICY "Admins manage base_conhecimento" ON public.base_conhecimento
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins manage configuracoes_agente" ON public.configuracoes_agente;
CREATE POLICY "Admins manage configuracoes_agente" ON public.configuracoes_agente
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY "Admins manage perguntas" ON public.perguntas_formulario;
CREATE POLICY "Admins manage perguntas" ON public.perguntas_formulario
FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION public.has_role(uuid, public.app_role);
