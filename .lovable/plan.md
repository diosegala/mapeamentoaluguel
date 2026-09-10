# Diagnóstico da Operação de Locação — Imersão Cupola Aluguel

Webapp onde a imobiliária entra com um código, responde um questionário guiado sobre sua operação de locação e recebe um relatório de diagnóstico escrito por IA no tom de um consultor sênior da CUPOLA. A CUPOLA controla tudo por um painel interno.

## O que será construído

### Páginas públicas (sem login)
- **Início** — explica o diagnóstico e pede o código recebido da CUPOLA. Código válido leva ao formulário no ponto onde parou; diagnóstico já concluído leva direto ao relatório; código inexistente mostra "código inválido".
- **Formulário** (`/formulario/:codigo`) — 6 seções (identificação, pessoas, processos, tecnologia, uso de IA, indicadores). Respostas em botões selecionáveis, campos "Outro" quando aplicável, campos numéricos e de moeda com máscara. Barra de progresso, validação de obrigatórias, salvamento a cada seção e tela de transição (1,5–3s) com frase motivacional entre seções. Na última seção o botão vira "Gerar Mapeamento". Seções sem perguntas ativas são puladas automaticamente.
- **Aguardando relatório** — animação de carregamento com atualização automática do status; erro mostra "Tentar novamente" sem perder respostas.
- **Relatório** (`/relatorio/:codigo`) — relatório formatado, somente leitura, com o aviso obrigatório de que foi gerado por IA e é um diagnóstico inicial.

### Painel administrativo (`/admin`, com login)
- **Novo diagnóstico** — nome da imobiliária, cidade e estado; o sistema gera o código (6–8 caracteres maiúsculos, sem caracteres ambíguos) para o admin copiar e enviar.
- **Dashboard** — tabela com código, imobiliária, cidade, status, datas; filtros por status e cidade, busca por código/nome; clique abre o detalhe com respostas e relatório, e botão "Regenerar relatório" (cria nova versão).
- **Prompt do agente** — edição do prompt do sistema com versionamento e histórico; salvar ativa a nova versão e desativa a anterior.
- **Base de conhecimento** — cadastro de documentos por link público do Google Docs, botão "Sincronizar" por documento, status de sincronização e chave ativo/inativo. Documento com erro não trava a geração dos relatórios.
- **Perguntas do formulário** — criar, editar, reordenar e desativar perguntas dentro das 6 seções fixas. Chave interna gerada do texto e imutável; exclusão é desativação (respostas antigas preservadas); opções obrigatórias em perguntas de escolha; troca de tipo com resposta já registrada pede confirmação.

## Detalhes técnicos

- **Backend**: Lovable Cloud (banco Postgres, autenticação do admin, código de servidor). Tabelas conforme o PRD: `diagnosticos`, `relatorios`, `base_conhecimento`, `configuracoes_agente`, `perguntas_formulario`, além de `user_roles` (papel `admin`) para o controle de acesso.
- **Segurança de dados**: acesso público restrito por código — leitura/gravação do próprio diagnóstico apenas via funções de servidor que validam o código; nenhuma listagem pública de diagnósticos. Painel admin exige sessão autenticada com papel `admin`. Toda tabela recebe RLS e GRANTs.
- **Geração do relatório**: função de servidor que monta prompt de sistema (prompt ativo + regras fixas de formato + base de conhecimento concatenada por ordem) e mensagem do usuário com dados da imobiliária e respostas rotuladas (usando o texto salvo da pergunta, ou a chave como fallback). Chamada à API Anthropic com `claude-sonnet-4-6`, em streaming no servidor. Grava `relatorios` com snapshot do prompt, ids dos documentos usados, tokens e status; erros ficam registrados e marcam `erro_geracao`. Truncamento defensivo em ~18.000 caracteres.
- **Chave da Anthropic**: será solicitada em formulário seguro (`ANTHROPIC_API_KEY`) e usada somente no servidor.
- **Sincronização do Google Docs**: função de servidor que baixa o texto exportado do link público e atualiza conteúdo e status.
- **Validações**: obrigatórias e números ≥ 0 validados na tela e novamente no servidor; "Nenhuma" desmarca as demais opções nas perguntas de IA.
- **Admin inicial**: dioner.segala@cupola.com.br recebe o papel `admin` via migration; senha definida no primeiro cadastro.
- **Seed**: migration insere todas as perguntas descritas no PRD e um prompt de sistema inicial da CUPOLA.
- **Design**: paleta CUPOLA (verde #B0F907 sobre branco, textos #171717, painel admin escuro #171717), fonte Inter, raio 10px, escala tipográfica do PRD, tudo em variáveis do tema.

## Fora desta versão
Login do cliente final, gestão das seções pela UI, exportação em PDF e vetorização da base de conhecimento.

## Ordem de execução
1. Ativar o backend, criar tabelas, políticas de acesso e seed das perguntas e do prompt.
2. Guardar a chave da Anthropic e criar as funções de servidor (validação de código, gravação por seção, geração de relatório, sincronização de documentos).
3. Design system CUPOLA + páginas públicas (início, formulário, carregamento, relatório).
4. Painel admin completo com login e as quatro abas.
5. Teste ponta a ponta: criar diagnóstico no admin, preencher pelo código, gerar e ler o relatório.
