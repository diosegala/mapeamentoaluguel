# Finalizar o fluxo ponta a ponta com segurança

Objetivo: ainda hoje, a imobiliária entra com o código, responde o questionário, recebe o relatório da IA, e a CUPOLA acompanha e envia tudo pelo painel. Tudo isso sem vazamento de dados entre clientes e sem permitir que alguém fique testando códigos à vontade.

## O que será entregue (em ordem)

1. **Proteção contra tentativas de código**
   - Cada aparelho ou conexão pode errar o código no máximo 5 vezes em 15 minutos. Depois disso, fica bloqueado por 30 minutos e aparece a mensagem "Muitas tentativas, aguarde alguns minutos".
   - Os códigos novos passam a ter 8 caracteres (hoje são 6). Isso gera cerca de 1 trilhão de combinações. Os códigos que já existem continuam funcionando.
   - Código errado e código bloqueado mostram a mesma mensagem, para que ninguém consiga deduzir quais códigos existem.

2. **Formulário público real** (`/formulario/:codigo`)
   - Só carrega depois que o servidor confirma o código.
   - As perguntas ativas vêm do banco e seguem as 6 seções. Seções sem perguntas são puladas.
   - Usa os botões de escolha, o campo "Outro" e os campos de número e de moeda que já existem.
   - A barra de progresso, a validação e a tela de transição com frase entre seções também aproveitam o que já existe.
   - As respostas são salvas a cada seção, então o cliente pode fechar e voltar de onde parou.
   - Na última seção, o botão "Gerar Mapeamento" encerra o preenchimento e inicia o relatório.
   - Se o diagnóstico já estiver concluído, o cliente vai direto para o relatório.

3. **Geração do relatório pela IA**
   - O relatório é montado com o prompt ativo, o modelo escolhido no painel, os documentos ativos da base de conhecimento e as respostas rotuladas com o texto de cada pergunta.
   - A chamada à Anthropic acontece somente no servidor, usando a chave guardada no cofre.
   - Cada geração fica registrada com o modelo, os tokens usados, a cópia do prompt e os documentos utilizados. Assim o dashboard de custos passa a funcionar sozinho.
   - Se der erro, as respostas não se perdem. O cliente vê "Tentar novamente", limitado a 3 tentativas por hora por diagnóstico.

4. **Tela de espera e relatório** (`/relatorio/:codigo`)
   - Enquanto o relatório é gerado, aparece uma animação com atualização automática.
   - O relatório pronto é formatado, somente leitura, e traz o aviso obrigatório de que foi gerado por IA e é um diagnóstico inicial.

5. **Painel: detalhe do diagnóstico e envio**
   - Clicar numa linha do dashboard abre as respostas, as versões do relatório e o botão "Regenerar relatório", que cria uma nova versão.
   - Envio ao cliente: botões "Copiar link" e "Enviar por WhatsApp", com mensagem pronta. O envio por e-mail fica para uma próxima etapa.

6. **Teste completo**: criar um diagnóstico no painel, preencher pelo código, gerar, ler o relatório e conferir os custos. Também vamos confirmar o bloqueio após 5 erros e que o código de um cliente não abre os dados de outro.

## Garantias de segurança
- **Nenhum acesso público direto ao banco.** Diagnósticos e relatórios continuam liberados apenas para administradores. O cliente só lê e grava por meio do servidor, que confere o código a cada pedido e devolve somente os dados daquele diagnóstico.
- **O cliente nunca envia um identificador interno**, apenas o código. Não existe nenhuma função que liste diagnósticos ou relatórios sem login de administrador.
- **Diagnóstico concluído não aceita novas respostas.** As respostas são validadas de novo no servidor: campos obrigatórios, números maiores ou iguais a zero e tamanho máximo.
- **A página do relatório não é indexada** por buscadores e não mostra o nome da imobiliária na prévia de compartilhamento.
- **A chave da Anthropic nunca chega ao navegador.**

## Detalhes técnicos
- Nova tabela `tentativas_codigo`: guarda um hash do IP, a data e se deu acerto. Tem RLS ativo, sem nenhuma política, e é acessada apenas pelo servidor com a chave de serviço. O limite é verificado antes da consulta do código.
- Novo arquivo `src/lib/publico.functions.ts`, com funções públicas que validam o código com zod (maiúsculas, 6–8 caracteres, alfabeto sem caracteres ambíguos) e usam `supabaseAdmin` carregado dentro do handler:
  - `abrirDiagnostico`: aplica o limite de tentativas e devolve as perguntas ativas, as respostas e a seção atual.
  - `salvarSecao`
  - `concluirEGerar`
  - `statusRelatorio`
  - `lerRelatorio`: devolve apenas o conteúdo, sem prompt nem tokens.
- `gerarRelatorio.server.ts` é compartilhado pelas funções públicas e pela regeneração no admin. Ele usa a Anthropic Messages API com o modelo definido em `configuracoes_agente.modelo`, o prompt, a base de conhecimento truncada de forma defensiva e grava `relatorios` e `diagnosticos.status` (`gerando_relatorio`, `concluido`, `erro_geracao`).
- Para não esbarrar no tempo limite do servidor, a geração roda em uma chamada separada. A tela de espera consulta o status a cada 3 segundos.
- `admin.functions.ts` ganha `detalheDiagnostico` e `regenerarRelatorio`, ambos com `garantirAdmin`. O gerador de códigos passa a criar códigos de 8 caracteres.
- Nova rota `_authenticated/admin_.diagnostico.$id.tsx`. O relatório é renderizado com `react-markdown`.
