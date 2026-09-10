
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- DIAGNOSTICOS
CREATE TABLE public.diagnosticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome_imobiliaria text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL,
  status text NOT NULL DEFAULT 'nao_iniciado',
  secao_atual integer NOT NULL DEFAULT 1,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosticos TO authenticated;
GRANT ALL ON public.diagnosticos TO service_role;
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage diagnosticos" ON public.diagnosticos
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_diagnosticos_updated BEFORE UPDATE ON public.diagnosticos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RELATORIOS
CREATE TABLE public.relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostico_id uuid NOT NULL REFERENCES public.diagnosticos(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  conteudo text,
  status text NOT NULL DEFAULT 'gerando',
  erro text,
  prompt_snapshot text,
  documentos_usados jsonb NOT NULL DEFAULT '[]'::jsonb,
  tokens_entrada integer,
  tokens_saida integer,
  modelo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostico_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios TO authenticated;
GRANT ALL ON public.relatorios TO service_role;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage relatorios" ON public.relatorios
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_relatorios_updated BEFORE UPDATE ON public.relatorios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BASE DE CONHECIMENTO
CREATE TABLE public.base_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  url_google_docs text,
  conteudo text,
  origem text NOT NULL DEFAULT 'google_docs',
  status_sincronizacao text NOT NULL DEFAULT 'pendente',
  erro_sincronizacao text,
  ultima_sincronizacao timestamptz,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_conhecimento TO authenticated;
GRANT ALL ON public.base_conhecimento TO service_role;
ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage base_conhecimento" ON public.base_conhecimento
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_base_conhecimento_updated BEFORE UPDATE ON public.base_conhecimento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CONFIGURACOES DO AGENTE
CREATE TABLE public.configuracoes_agente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_sistema text NOT NULL,
  versao integer NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_agente TO authenticated;
GRANT ALL ON public.configuracoes_agente TO service_role;
ALTER TABLE public.configuracoes_agente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage configuracoes_agente" ON public.configuracoes_agente
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_configuracoes_agente_updated BEFORE UPDATE ON public.configuracoes_agente
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PERGUNTAS DO FORMULARIO
CREATE TABLE public.perguntas_formulario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secao integer NOT NULL,
  chave text NOT NULL UNIQUE,
  texto text NOT NULL,
  descricao text,
  tipo text NOT NULL,
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  permite_outro boolean NOT NULL DEFAULT false,
  obrigatoria boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.perguntas_formulario TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perguntas_formulario TO authenticated;
GRANT ALL ON public.perguntas_formulario TO service_role;
ALTER TABLE public.perguntas_formulario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active perguntas" ON public.perguntas_formulario
FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "Admins manage perguntas" ON public.perguntas_formulario
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_perguntas_updated BEFORE UPDATE ON public.perguntas_formulario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Papel admin automatico para o e-mail inicial
CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'dioner.segala@cupola.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'dioner.segala@cupola.com.br'
ON CONFLICT DO NOTHING;

-- PROMPT INICIAL
INSERT INTO public.configuracoes_agente (prompt_sistema, versao, ativo) VALUES (
'Você é um consultor sênior da CUPOLA, especialista em operações de locação de imobiliárias no Brasil. Escreva um diagnóstico inicial da operação da imobiliária com base nas respostas fornecidas.

Tom: direto, técnico, consultivo e respeitoso. Sem jargão vazio, sem elogios genéricos.

Estrutura obrigatória do relatório (markdown):
1. Panorama geral da operação
2. Pessoas
3. Processos
4. Tecnologia
5. Uso de Inteligência Artificial
6. Indicadores e gestão
7. Prioridades recomendadas (3 a 5 ações, em ordem de impacto)

Regras: baseie-se apenas nas respostas e na base de conhecimento fornecida; quando faltar informação, aponte a lacuna em vez de inventar; use números da própria imobiliária sempre que possível.', 1, true);

-- SEED DE PERGUNTAS
INSERT INTO public.perguntas_formulario (secao, chave, texto, tipo, opcoes, obrigatoria, ordem, permite_outro) VALUES
(1,'nome_responsavel','Qual o seu nome?','texto','[]',true,1,false),
(1,'cargo_responsavel','Qual o seu cargo na imobiliária?','texto','[]',true,2,false),
(1,'email_responsavel','Qual o seu e-mail de contato?','texto','[]',true,3,false),
(1,'tempo_mercado','Há quanto tempo a imobiliária atua no mercado?','escolha_unica','["Menos de 2 anos","2 a 5 anos","6 a 10 anos","11 a 20 anos","Mais de 20 anos"]',true,4,false),
(1,'imoveis_administrados','Quantos imóveis a imobiliária administra hoje?','numero','[]',true,5,false),
(1,'faturamento_locacao','Qual o faturamento mensal aproximado da locação?','moeda','[]',false,6,false),

(2,'tamanho_equipe_locacao','Quantas pessoas trabalham na operação de locação?','numero','[]',true,1,false),
(2,'estrutura_equipe','Como a equipe de locação está estruturada?','escolha_unica','["Uma pessoa faz tudo","Times separados por etapa (captação, locação, administração)","Times separados por carteira de clientes","Estrutura mista"]',true,2,true),
(2,'existe_lider','Existe um líder dedicado à área de locação?','escolha_unica','["Sim, dedicado exclusivamente","Sim, mas acumula outras funções","Não existe líder formal"]',true,3,false),
(2,'treinamento','Com que frequência a equipe recebe treinamento?','escolha_unica','["Mensalmente ou mais","Trimestralmente","Uma ou duas vezes por ano","Não há treinamento estruturado"]',true,4,false),
(2,'maior_dificuldade_pessoas','Qual a maior dificuldade da equipe hoje?','texto_longo','[]',false,5,false),

(3,'processos_documentados','Os processos de locação estão documentados?','escolha_unica','["Sim, documentados e seguidos","Documentados, mas pouco seguidos","Parcialmente documentados","Não estão documentados"]',true,1,false),
(3,'etapas_criticas','Quais etapas mais geram retrabalho ou atraso?','escolha_multipla','["Captação de imóveis","Visitas","Análise de crédito","Elaboração de contrato","Vistoria","Repasse ao proprietário","Cobrança e inadimplência","Rescisão e devolução"]',true,2,true),
(3,'tempo_medio_locacao','Qual o tempo médio, em dias, entre a proposta e a assinatura do contrato?','numero','[]',false,3,false),
(3,'analise_credito','Como é feita a análise de crédito do locatário?','escolha_unica','["Empresa especializada / garantidora","Análise interna manual","Sistema próprio automatizado","Depende do caso"]',true,4,true),
(3,'atendimento_canais','Por quais canais a imobiliária atende os clientes de locação?','escolha_multipla','["WhatsApp","Telefone","E-mail","Portal do cliente","Presencial","Redes sociais"]',true,5,true),

(4,'sistema_gestao','Qual sistema de gestão (ERP) a imobiliária utiliza na locação?','texto','[]',true,1,false),
(4,'satisfacao_sistema','Qual o nível de satisfação com o sistema atual?','escolha_unica','["Muito satisfeito","Satisfeito","Neutro","Insatisfeito","Muito insatisfeito"]',true,2,false),
(4,'integracoes','Quais ferramentas estão integradas ao sistema principal?','escolha_multipla','["Portais de imóveis","CRM","Assinatura eletrônica","Vistoria digital","Cobrança / financeiro","Business Intelligence","Nenhuma integração"]',true,3,true),
(4,'assinatura_digital','A imobiliária usa assinatura eletrônica nos contratos?','escolha_unica','["Sim, em todos os contratos","Em parte dos contratos","Não usa"]',true,4,false),
(4,'gargalo_tecnologia','Qual o maior gargalo tecnológico hoje?','texto_longo','[]',false,5,false),

(5,'usa_ia','A imobiliária já utiliza inteligência artificial em alguma atividade?','escolha_unica','["Sim, de forma estruturada","Sim, de forma informal (uso individual)","Estamos testando","Não utilizamos"]',true,1,false),
(5,'aplicacoes_ia','Em quais atividades a IA é usada hoje?','escolha_multipla','["Nenhuma","Atendimento e triagem","Redação de anúncios","Análise de documentos","Resumo de contratos","Cobrança","Relatórios e análise de dados","Treinamento da equipe"]',true,2,true),
(5,'ferramentas_ia','Quais ferramentas de IA a equipe utiliza?','texto','[]',false,3,false),
(5,'politica_ia','Existe alguma política ou diretriz interna sobre uso de IA?','escolha_unica','["Sim, formalizada","Em construção","Não existe"]',true,4,false),
(5,'expectativa_ia','O que você espera que a IA resolva na sua operação?','texto_longo','[]',false,5,false),

(6,'indicadores_acompanhados','Quais indicadores a imobiliária acompanha na locação?','escolha_multipla','["Tempo médio de locação","Taxa de inadimplência","Vacância da carteira","Número de captações","Cancelamentos / rescisões","Satisfação do cliente (NPS)","Nenhum indicador formal"]',true,1,true),
(6,'frequencia_analise','Com que frequência os indicadores são analisados?','escolha_unica','["Semanalmente","Mensalmente","Trimestralmente","Raramente ou nunca"]',true,2,false),
(6,'inadimplencia','Qual a taxa de inadimplência atual, em porcentagem?','numero','[]',false,3,false),
(6,'vacancia','Qual a taxa de vacância da carteira, em porcentagem?','numero','[]',false,4,false),
(6,'meta_12_meses','Qual a principal meta da operação de locação para os próximos 12 meses?','texto_longo','[]',false,5,false);
