# Leitura e insights da base de conhecimento

Hoje a aba "Base de conhecimento" guarda apenas os links: nada é lido de fato, e o status fica sempre "pendente". A ideia é o painel efetivamente ler cada documento e mostrar ao admin o que o agente entendeu.

## O que muda na tela

Cada link passa a ter:
- **Botão "Ler documento"** (e um "Ler todos" no topo) que busca o texto do link e o entrega ao agente.
- **Selo de status**: Lido / Não consegui ler / Nunca lido, com a data da última leitura e, em caso de falha, o motivo em linguagem simples (link privado, formato não suportado, documento vazio).
- **Indicadores de leitura**: número de caracteres lidos e um trecho inicial do texto, para o admin confirmar de imediato que veio o conteúdo certo (e não uma página de login do Google).
- **Painel "O que o agente entendeu"** (expansível): resumo curto do documento, principais temas identificados e 3 a 6 insights em tópicos.
- Aviso quando o link do Google Docs não estiver público, com a instrução de compartilhar como "qualquer pessoa com o link pode ver".

A tela também mostra, no topo, um resumo geral: quantos documentos estão lidos, com erro e nunca lidos.

## Detalhes técnicos

- **Banco**: nova migration adicionando a `base_conhecimento` as colunas `resumo_ia text`, `insights jsonb default '[]'`, `temas jsonb default '[]'`, `caracteres int`, `trecho text`, `analisado_em timestamptz`. As colunas `conteudo`, `status_sincronizacao`, `erro_sincronizacao` e `ultima_sincronizacao` já existem e passam a ser usadas.
- **Função de servidor `sincronizarDocumento`** (`src/lib/conhecimento.functions.ts`, autenticada + checagem de admin, no mesmo padrão das demais):
  1. Normaliza o link do Google Docs para a URL de exportação em texto (`/export?format=txt`) quando for um documento; outros links são baixados direto e limpos de HTML.
  2. Detecta resposta de login/permissão do Google e grava `status_sincronizacao='erro'` com mensagem amigável.
  3. Salva `conteudo`, `caracteres`, `trecho` (primeiros ~400 caracteres) e `ultima_sincronizacao`.
  4. Chama a Anthropic (`claude-sonnet-4-6`, chave lida do cofre pela mesma via de `uso.functions.ts`) pedindo JSON com `resumo`, `temas[]` e `insights[]`, com truncamento defensivo do texto enviado (~40.000 caracteres) e `max_tokens` baixo.
  5. Grava resumo/temas/insights e marca `status_sincronizacao='ok'`. Falha da IA não apaga o conteúdo lido: fica "lido, sem análise" com o erro registrado.
- **Função `sincronizarTodos`**: percorre os documentos ativos em sequência, com tolerância a falhas individuais.
- `listarDocumentos` passa a retornar os novos campos; a UI usa React Query com invalidação após cada leitura, sem mudar o restante da tela.
- Se a chave da Anthropic não estiver configurada, a leitura do texto acontece normalmente e a análise aparece como indisponível, com link para a aba "Chave e uso".

## Fora desta etapa
Leitura automática agendada (por enquanto é sob demanda) e uso dos insights dentro do prompt de geração do relatório — o relatório continua usando o conteúdo completo dos documentos.
