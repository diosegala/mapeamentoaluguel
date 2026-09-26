# [ICA] Mapeamento

PRD — Diagnóstico da Operação de Locação (Imersão Cupola Aluguel)

1. Contexto e Objetivo

Webapp de diagnóstico/mapeamento da operação de locação de imobiliárias, entregue como parte do produto Imersão Cupola Aluguel. O cliente (imobiliária) preenche um formulário estruturado sobre sua operação de locação (pessoas, processos, tecnologia e indicadores objetivos) e recebe um relatório de diagnóstico gerado por IA, escrito no padrão de um consultor sênior da CUPOLA.

Não existe autenticação de usuário final (cliente da imobiliária). O acesso ao formulário e ao relatório é controlado por um código único de diagnóstico. Existe autenticação apenas para o painel administrativo interno da CUPOLA.

2. Stack Técnica

Camada Tecnologia Frontend React + Vite + shadcn/ui + Tailwind CSS Backend/DB Supabase (Postgres + Edge Functions + Auth para admin) Geração do relatório API Anthropic — modelo claude-sonnet-4-6, chamado a partir de uma Edge Function do Supabase (nunca do client-side, para não expor a API key) Base de conhecimento Documentos do Google Docs, importados/sincronizados como texto puro e armazenados no Supabase Autenticação admin Supabase Auth (e-mail/senha), role admin

3. Modelo de Dados (Supabase / Postgres)

3.1 diagnosticos

Registro central de cada cliente/imobiliária que inicia um diagnóstico.

Campo Tipo Regras id uuid, PK default gen_random_uuid() codigo text, unique, not null código curto alfanumérico (6–8 caracteres, maiúsculo, sem caracteres ambíguos tipo 0/O, 1/I), gerado pelo backend quando o admin CUPOLA cria um novo diagnóstico (ver 5.6) status enum: nao_iniciado, em_andamento, respostas_completas, gerando_relatorio, concluido, erro_geracao default nao_iniciado secao_atual int default 0. Índice da última seção completada, usado para retomar o formulário nome_imobiliaria text preenchido pelo admin CUPOLA ao criar o diagnóstico (ver 5.6), não pelo cliente cidade text preenchido pelo admin CUPOLA ao criar o diagnóstico (ver 5.6), não pelo cliente estado text (UF) preenchido pelo admin CUPOLA ao criar o diagnóstico (ver 5.6), não pelo cliente nome_respondente text cargo_respondente text email_respondente text, nullable usado para envio do relatório, não obrigatório respostas jsonb, default {} objeto acumulativo com todas as respostas, chaveado por perguntas_formulario.pergunta_key (ver 3.5 e seção 4) secoes_completas text[], default {} lista de chaves de seções já salvas created_at timestamptz default now() updated_at timestamptz atualizado a cada gravação de seção relatorio_gerado_em timestamptz, nullable

3.2 relatorios

Um relatório por diagnóstico (relação 1:1, mas mantendo versionamento em caso de regeneração manual pelo admin).

Campo Tipo Regras id uuid, PK diagnostico_id uuid, FK → diagnosticos.id versao int default 1, incrementa em regeneração manual conteudo_markdown text conteúdo completo do relatório gerado pelo modelo status enum: gerando, concluido, erro erro_mensagem text, nullable modelo_ia text ex: claude-sonnet-4-6 prompt_sistema_snapshot text cópia do prompt do sistema usado nesta geração específica (auditoria) base_conhecimento_ids uuid[] quais documentos da base de conhecimento foram usados nesta geração tokens_input int, nullable tokens_output int, nullable created_at timestamptz

A view/consulta do relatório ativo de um diagnóstico é sempre a de maior versao com status = concluido.

3.3 base_conhecimento

Documentos do Google Docs usados como contexto (RAG simples via concatenação, sem necessidade de vetorização dado o volume pequeno de documentos — reavaliar pgvector apenas se a base crescer muito).

Campo Tipo Regras id uuid, PK titulo text url_google_doc text precisa ser um link compartilhado publicamente ("qualquer pessoa com o link pode visualizar") conteudo_extraido text, nullable texto sincronizado a partir do Google Doc status_sincronizacao enum: pendente, sincronizado, erro erro_sincronizacao text, nullable ativo boolean, default true somente documentos ativos entram no prompt ordem int, default 0 ordem de concatenação no prompt ultima_sincronizacao timestamptz, nullable created_at / updated_at timestamptz

3.4 configuracoes_agente

Prompt do sistema usado para gerar o diagnóstico. Versionado; apenas uma versão ativo = true por vez.

Campo Tipo Regras id uuid, PK versao int auto-incremento lógico prompt_sistema text prompt completo editável via admin ativo boolean, default false apenas 1 registro true por vez (garantir via lógica de aplicação: ao ativar um, desativa os demais) atualizado_por text e-mail do admin created_at timestamptz

3.5 perguntas_formulario

Define as perguntas do questionário exibidas ao cliente. Totalmente editável pelo admin (inserir, editar, excluir — ver 5.6), substituindo qualquer lista hardcoded na UI. A tabela é povoada inicialmente via seed/migration com o conteúdo descrito na seção 4.

Campo Tipo Regras id uuid, PK pergunta_key text, unique, not null slug estável (ex: nome_respondente), usado como chave no jsonb diagnosticos.respostas. Gerado automaticamente na criação e imutável depois — editar o texto da pergunta não altera a chave, para não quebrar respostas já salvas secao_id enum: identificacao, pessoas, processos, tecnologia, uso_ia, indicadores seções fixas da v1 (não editáveis via admin nesta versão — apenas as perguntas dentro delas) texto_pergunta text, not null label exibido ao cliente; livremente editável tipo enum: single_select, multi_select, texto_livre, numero, moeda opcoes jsonb, nullable array de { "label": string, "permite_outro": boolean }; obrigatório e não vazio quando tipo é single_select/multi_select; ignorado nos demais tipos obrigatoria boolean, default true ordem int, not null ordem de exibição dentro da seção; admin reordena via drag-and-drop ou botões subir/descer ativa boolean, default true "excluir" uma pergunta no admin é um soft delete (ativa = false): a pergunta some do formulário para novos preenchimentos, mas o histórico em diagnosticos.respostas e o mapeamento de label para geração de relatório continuam preservados created_at / updated_at timestamptz

3.6 admin_usuarios

Gerenciado via Supabase Auth nativo; tabela de perfil complementar se necessário.

Campo Tipo id uuid, FK → auth.users.id nome text role enum: admin (único valor por ora)

4. Estrutura do Formulário (seções e perguntas)

O formulário é dividido em 6 seções fixas. As perguntas em si não são hardcoded na UI — vêm da tabela perguntas_formulario (3.5), totalmente gerenciável pelo admin (5.6). O front busca as perguntas ativas (ativa = true) ordenadas por secao_id e ordem, e renderiza o formulário dinamicamente a partir disso. Perguntas de escolha usam botões (single_select, salvo como string, ou multi_select, salvo como array de strings). Perguntas de valor usam input numérico ou de moeda.

A lista abaixo é o conteúdo inicial (seed) a ser inserido via migration na primeira implantação — o admin pode editar/adicionar/remover qualquer item depois pela UI (5.6).

Seção 1 — Identificação do respondente (secao_id: identificacao)

nome_imobiliaria, cidade e estado não são preenchidos pelo cliente. São definidos pelo admin CUPOLA no momento da criação do diagnóstico (ver 5.6), pois já são conhecidos na entrada do cliente no programa. O formulário do cliente começa direto pela identificação do respondente.

nome_respondente (texto livre, obrigatório)

cargo_respondente (botões single-select, obrigatório): Dono/Sócio, Diretor, Gerente, Outro (se Outro, abrir campo de texto livre cargo_respondente_outro)

email_respondente (texto livre, opcional, validação de formato e-mail)

Seção 2 — Pessoas (secao_id: pessoas)

tamanho_equipe_locacao (botões single-select, obrigatório): 1-2, 3-5, 6-10, 11-20, 20+

papeis_existentes (botões multi-select, obrigatório, mín. 1): Captador, Corretor de locação, Atendimento/SDR, Gestor de contratos, Financeiro, Vistoriador, Outro

lideranca_dedicada_locacao (botões single-select, obrigatório): Sim, Não

Seção 3 — Processos (secao_id: processos)

modelo_captacao (botões single-select, obrigatório): Ativa/Prospecção, Passiva/Indicação, Portais, Mista

sla_atendimento_leads (botões single-select, obrigatório): Sim, formalizado, Parcialmente, Não existe

processo_desocupacao_vistoria (botões single-select, obrigatório): Formalizado e padronizado, Existe mas informal, Não existe processo definido

funil_comercial_estruturado (botões single-select, obrigatório): Sim, Não

Seção 4 — Tecnologia (secao_id: tecnologia)

sistema_gestao_imobiliaria (botões single-select, obrigatório): Imoview, Vista, Union, Outro (se Outro, campo livre sistema_gestao_outro)

utiliza_crm (botões single-select, obrigatório): Sim, Não

possui_automacoes (botões single-select, obrigatório): Sim, Não

utiliza_dashboards_indicadores (botões single-select, obrigatório): Sim, Não

Seção 5 — Uso de Inteligência Artificial (secao_id: uso_ia)

ferramentas_ia_generalistas (botões multi-select, obrigatório, mín. 1): ChatGPT, Claude, Gemini, Nenhuma, Outra (se Outra, campo livre ferramentas_ia_generalistas_outra; selecionar Nenhuma desmarca automaticamente as demais opções)

ferramentas_ia_mercado_imobiliario (botões multi-select, obrigatório, mín. 1): Laís, Maya, Realmate, Nenhuma, Outra (se Outra, campo livre ferramentas_ia_mercado_imobiliario_outra; selecionar Nenhuma desmarca automaticamente as demais opções)

nivel_disseminacao_ia (botões single-select, obrigatório): Não utilizamos IA hoje, Uso pontual (poucas pessoas), Parcialmente disseminado (alguns times/funções), Amplamente disseminado (toda a operação)

lideranca_iniciativas_ia (botões single-select, obrigatório): Diretoria/Sócios, Time de tecnologia/dados, Iniciativa individual dos colaboradores, Ninguém lidera hoje

principal_barreira_ia (botões single-select, obrigatório): Falta de conhecimento/capacitação, Falta de tempo, Resistência da equipe, Custo, Não vê necessidade, Nenhuma barreira relevante

Seção 6 — Indicadores objetivos (secao_id: indicadores, todos numéricos, obrigatórios, aceitam apenas valores ≥ 0)

estoque_imoveis_anunciados (inteiro)

locacoes_fechadas_mes (inteiro)

captacoes_imoveis_mes (inteiro)

leads_gerados_mes (inteiro)

desocupacoes_mes (inteiro)

vgl_mensal (decimal, moeda BRL, input com máscara de moeda)

ticket_medio_aluguel (decimal, moeda BRL, opcional)

Ao rodar o seed, cada item acima vira uma linha em perguntas_formulario, com pergunta_key = o identificador usado entre crases (ex: nome_respondente), secao_id conforme a seção, opcoes conforme os botões listados, e ordem seguindo a posição na lista.

5. Fluxos Principais

5.1 Home

Página explicando o propósito do diagnóstico (pessoas, processos, tecnologia, uso de IA + indicadores objetivos).

Único CTA: campo de input para o cliente digitar o código de diagnóstico recebido previamente da CUPOLA (o código é gerado pelo admin ao criar o diagnóstico — ver 5.6, não pelo cliente).

Se o código existir e estiver nao_iniciado ou em_andamento, redireciona para /formulario/:codigo na seção salva (secao_atual).

Se o diagnóstico já estiver concluido, redireciona direto para /relatorio/:codigo.

Se o código não existir, exibe mensagem de erro "código inválido".

5.2 Formulário (/formulario/:codigo)

Ao carregar, busca o registro em diagnosticos pelo codigo. Se não existir → tela de erro "código inválido".

Renderiza a seção correspondente a secao_atual (ou a primeira seção não completada em secoes_completas).

Botões de resposta ficam com estado visual de selecionado; validação impede avançar sem responder todas as perguntas obrigatórias da seção.

Ao clicar em "Avançar":

Faz merge das respostas da seção atual dentro do jsonb respostas (upsert, não sobrescreve seções anteriores).

Adiciona secao_id a secoes_completas (se ainda não estiver).

Atualiza secao_atual e status = em_andamento.

Exibe uma tela de transição (1,5–3s) com frase motivacional aleatória (lista fixa de frases no frontend, sem necessidade de tabela no banco) antes de renderizar a próxima seção.

Na última seção, ao responder todas as perguntas obrigatórias, o botão "Avançar" é substituído por "Gerar Mapeamento".

Ao clicar em "Gerar Mapeamento":

Grava a última seção, seta status = respostas_completas, então imediatamente status = gerando_relatorio.

Dispara a Edge Function de geração de relatório (ver 5.3).

Exibe animação de carregamento (a operação é assíncrona; a UI faz polling do status do diagnóstico a cada poucos segundos, ou escuta via Supabase Realtime na tabela diagnosticos/relatorios).

Ao status = concluido, redireciona para /relatorio/:codigo.

Ao status = erro_geracao, exibe mensagem de erro com botão "Tentar novamente".

5.3 Geração do relatório (Edge Function)

Recebe diagnostico_id.

Busca respostas do diagnóstico, o prompt_sistema ativo em configuracoes_agente, e o conteúdo concatenado (ordenado por ordem) de todos os registros ativo = true em base_conhecimento.

Monta o prompt para a API Anthropic:

System prompt = prompt_sistema (editável via admin) + instrução fixa de formato (ver 5.4) + base de conhecimento concatenada.

User message = respostas estruturadas do diagnóstico (formatadas em markdown/JSON legível), incluindo nome da imobiliária, cidade e todos os indicadores.

Chama a API Anthropic (claude-sonnet-4-6), captura o markdown de resposta.

Cria registro em relatorios com status = concluido e o conteúdo. Atualiza diagnosticos.status = concluido e relatorio_gerado_em = now().

Em caso de falha (timeout, erro da API, rate limit): cria registro em relatorios com status = erro e erro_mensagem, e atualiza diagnosticos.status = erro_geracao.

5.4 Instrução fixa de formato do relatório (parte do prompt, não editável pelo admin — regra de produto)

Máximo de 5 páginas equivalentes (referência: ~500–600 palavras por página).

Tom: consultor sênior da CUPOLA, objetivo, preciso, profissional — sem bullet excessivo, sem tom genérico de IA.

Estrutura sugerida: (1) capa/disclaimer, (2) panorama geral (pessoas, processos, tecnologia), (3) leitura dos indicadores objetivos frente a benchmarks do Método CUPOLA, (4) principais gaps identificados, (5) recomendações objetivas de próximos passos.

A primeira página deve obrigatoriamente conter um disclaimer informando que o relatório foi gerado por inteligência artificial e deve ser interpretado como um diagnóstico inicial, não como consultoria definitiva.

5.5 Página do Relatório (/relatorio/:codigo)

Busca o relatorio de maior versão com status = concluido vinculado ao diagnostico_id do código.

Renderiza o markdown formatado (usar um renderer de markdown → componentes shadcn, mantendo hierarquia visual de "páginas"/seções).

Não permite edição pelo cliente. Não requer login.

5.6 Painel Admin (/admin, autenticado via Supabase Auth)

Criar novo diagnóstico: formulário com nome_imobiliaria, cidade e estado (obrigatórios). Ao salvar, gera o codigo único (mesma regra: 6–8 caracteres alfanuméricos, maiúsculo, sem caracteres ambíguos) e cria o registro em diagnosticos com status = nao_iniciado. Exibe o código gerado para o admin copiar e enviar ao cliente.

Dashboard: tabela de todos os diagnosticos (código, imobiliária, cidade, status, data de criação, data de conclusão), com filtros por status e cidade, e busca por código/nome. Clique em uma linha abre o detalhe (respostas completas + relatório gerado, se houver).

Aba Prompt do Agente: textarea com o prompt_sistema ativo (de configuracoes_agente). Ao salvar, cria uma nova linha versionada e ativa (desativando a anterior). Deve ter preview/histórico de versões anteriores.

Aba Base de Conhecimento: lista de documentos (base_conhecimento) com título, status de sincronização e toggle ativo. Formulário para adicionar novo documento (título + URL do Google Docs). Botão "Sincronizar" por documento, que dispara uma Edge Function que busca o conteúdo público do Google Doc (via export como texto/HTML público) e atualiza conteudo_extraido e status_sincronizacao.

Aba Perguntas do Formulário: CRUD completo sobre perguntas_formulario, agrupado visualmente pelas 6 seções fixas.

Inserir: formulário com secao_id (select), texto_pergunta, tipo, opcoes (editor de lista de botões, com toggle "permite Outro" por opção, exibido apenas quando tipo é single_select/multi_select) e obrigatoria. O pergunta_key é gerado automaticamente a partir do texto_pergunta (slug) e exibido como somente leitura.

Editar: permite alterar texto_pergunta, opcoes, obrigatoria, ordem e secao_id livremente. Alterar o tipo de uma pergunta que já possui respostas registradas em algum diagnosticos.respostas exige confirmação explícita do admin (aviso de que respostas antigas podem não ser compatíveis com o novo tipo).

Excluir: remove a pergunta da lista visível para o admin e do formulário do cliente (soft delete, ativa = false); não apaga respostas já registradas.

Reordenar: drag-and-drop ou botões subir/descer dentro da seção, atualizando ordem.

Ação manual de "Regenerar relatório" disponível no detalhe de um diagnóstico concluído (cria nova versao em relatorios), para casos em que o admin ajustou o prompt e quer reprocessar um cliente específico.

6. Casos Extremos

Código inválido ao retomar diagnóstico: mensagem clara de erro, sem expor detalhes técnicos.

Cliente fecha o navegador no meio do preenchimento: coberto pela persistência por seção; ao reabrir com o mesmo código, retoma de secao_atual.

Duas abas abertas com o mesmo código simultaneamente: last-write-wins é aceitável (sem necessidade de lock otimista na v1).

Respostas numéricas inválidas (negativas, não numéricas, texto): validação client-side bloqueia avanço; validação server-side na Edge Function rejeita gravação fora do formato esperado.

Falha na chamada à API Anthropic (timeout, rate limit, erro 5xx): status = erro_geracao, permite retry manual pelo cliente (reprocessa a partir das respostas já salvas, sem precisar preencher de novo).

Prompt do sistema vazio ou inativo: a Edge Function de geração deve validar que existe um configuracoes_agente com ativo = true e prompt_sistema não vazio antes de chamar a API; caso contrário, falha com erro claro registrado em relatorios.erro_mensagem.

Google Doc inacessível/não público: sincronização falha, status_sincronizacao = erro, mensagem exibida no admin; o documento problemático simplesmente não entra na concatenação do prompt (não deve travar a geração de outros relatórios).

Relatório gerado excede o limite de tamanho: a instrução de formato (5.4) rege o modelo; adicionalmente, aplicar truncamento defensivo no backend caso o retorno exceda um teto de caracteres (ex: ~18.000 caracteres), para proteger a renderização.

Cliente tenta gerar o relatório mais de uma vez pelo fluxo público: uma vez status = concluido, o botão "Gerar Mapeamento" não deve reaparecer para o cliente; regeneração só ocorre via ação manual do admin.

Diagnóstico duplicado da mesma imobiliária: não há bloqueio de duplicidade — cada código é independente; a listagem no admin permite identificar duplicidades pelo nome da imobiliária.

Admin exclui uma pergunta que um cliente com diagnóstico em andamento já havia respondido: a resposta permanece em diagnosticos.respostas (não é apagada); a pergunta simplesmente não é mais exibida a ninguém a partir daquele momento, inclusive para quem está no meio do preenchimento.

Admin exclui todas as perguntas de uma seção: o formulário deve pular automaticamente qualquer seção sem perguntas ativas, sem quebrar a navegação nem exibir uma seção vazia ao cliente.

Admin cria uma pergunta de tipo single_select/multi_select sem preencher opcoes: bloquear salvamento no admin — opcoes não pode ser vazio para esses tipos.

Geração de relatório referenciando pergunta_key que não existe mais em perguntas_formulario (pergunta excluída depois que a resposta foi salva): a Edge Function de geração deve montar o contexto do prompt a partir de diagnosticos.respostas mesmo quando a pergunta correspondente está ativa = false ou não é encontrada — usando o texto_pergunta salvo, se disponível, ou o próprio pergunta_key como rótulo de fallback.

7. Design System (padrão CUPOLA)

7.1 Paleta de cores

:root {
  /* Primária */
  --primary: #B0F907;
  --primary-hover: #9DE006;
  --primary-foreground: #0A0A0A;

  /* Fundo */
  --background: #FFFFFF;
  --background-secondary: #F5F5F5;

  /* Texto */
  --foreground: #171717;
  --foreground-muted: #565656;
  --foreground-subtle: #959595;
  --foreground-on-dark: #FFFFFF;

  /* Interface */
  --border: #E3E3E3;
  --border-focus: #B0F907;
  --card: #FFFFFF;
  --card-hover: #F9FEE7;

  /* Semânticas */
  --destructive: #EF4444;
  --success: #22C55E;

  /* Modo escuro / sidebar admin */
  --dark-background: #171717;
  --dark-background-darker: #000000;
  --dark-border: #27272A;
}


7.2 Tipografia

Fonte: Inter (system-ui como fallback). Confirmar com o time de marketing se houver arquivo fonts.css específico do site institucional.

Pesos: 500 (medium), 600 (semibold), 700 (bold) para títulos; 400 para corpo de texto.

Escala:

Uso Desktop Mobile H1 principal 50px/54px 40px/44px H2 seção 30px/36px 30px/36px H3 subtítulo 24px/30px — Corpo 15–16px/20–24px — Badge/label 12–13px/16–17px —

7.3 Espaçamento e bordas

Border-radius padrão: 10px; 40px em badges/pills; 50% em elementos circulares.

Gaps comuns: 10px, 16px, 24px.

7.4 Componentes shadcn/ui necessários

Button (default, outline, ghost), Input, RadioGroup/botões customizados para single-select, ToggleGroup para multi-select, Progress (barra de progresso do formulário), Card, Skeleton (loading), Table (dashboard admin), Tabs (abas do admin), Textarea (edição de prompt), Dialog, Toast/Sonner (feedback de ações), Badge (status).

8. Fora de Escopo (v1)

Autenticação do cliente final (imobiliária) — acesso é só por código.

Gestão das 6 seções do formulário pela UI admin (seções são fixas na v1; apenas as perguntas dentro delas são editáveis).

Exportação do relatório em PDF (pode ser adicionado depois reaproveitando o markdown já armazenado).

Vetorização/pgvector da base de conhecimento — concatenação direta é suficiente dado o volume esperado de documentos.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mapeamentoaluguel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ce8b0e97-8a23-43e8-9edf-33627354d529).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
