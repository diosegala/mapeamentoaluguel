-- Leitura do Mentor direto pelo RLS, com a sessão dele (sem chave de serviço).
-- Só SELECT: o mentor não insere, altera nem apaga nada. As políticas de admin continuam como estão.

-- Diagnósticos com questionário concluído: a base do painel de mercado.
-- A lista e o detalhe do painel mostram ao mentor só os que têm relatório publicado.
CREATE POLICY "Mentores leem diagnosticos concluidos" ON public.diagnosticos
FOR SELECT TO authenticated
USING (concluido_em IS NOT NULL AND private.has_role(auth.uid(), 'mentor'));

-- Só as versões publicadas (a que o cliente recebeu); rascunhos ficam de fora.
CREATE POLICY "Mentores leem relatorios publicados" ON public.relatorios
FOR SELECT TO authenticated
USING (publicado_em IS NOT NULL AND private.has_role(auth.uid(), 'mentor'));

-- Só relatórios de mercado prontos.
CREATE POLICY "Mentores leem relatorios_mercado concluidos" ON public.relatorios_mercado
FOR SELECT TO authenticated
USING (status = 'concluido' AND private.has_role(auth.uid(), 'mentor'));

-- Textos das perguntas (inclusive as desativadas, para mostrar respostas antigas) e nomes das seções.
CREATE POLICY "Mentores leem perguntas" ON public.perguntas_formulario
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'mentor'));

CREATE POLICY "Mentores leem secoes" ON public.secoes_formulario
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'mentor'));
