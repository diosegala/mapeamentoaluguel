# Regras anti-invenção para o relatório de diagnóstico

## Objetivo
O relatório deve analisar somente o que o cliente respondeu. Nada de fatos, números, hipóteses ou recomendações sem base nas respostas, e nada de conclusões categóricas.

## O que muda

### 1. Regras fixas de evidência (valem sempre, qualquer versão do prompt)
Essas regras entram no sistema e são somadas a qualquer prompt salvo no painel, para que uma edição futura não as apague:
- **Só fatos respondidos:** toda afirmação sobre a imobiliária precisa vir de uma resposta do questionário. Proibido supor tamanho, faturamento, equipe, ferramentas ou práticas que não foram informados.
- **Recomendação com evidência:** cada recomendação cita a resposta (ou respostas) que a justificam, com "Com base em: ...". Sem resposta que sustente, a recomendação não entra.
- **Sem hipóteses soltas:** proibido usar "provavelmente", "é possível que", "deve estar", "suspeitamos". Quando faltar informação, escrever "Não informado no questionário" e, no máximo, sugerir que o ponto seja aprofundado no encontro.
- **Números:** só números informados ou cálculos diretos entre eles, mostrando a conta. Proibido usar médias de mercado ou referências externas como se fossem dados do cliente.
- **Base de conhecimento CUPOLA:** serve para explicar o método e os pilares, nunca como fonte de fatos sobre o cliente.
- **Tom não determinístico:** apresentar leituras como observações ("as respostas indicam", "segundo o informado"), sem sentenças definitivas sobre causas ou resultados futuros, sem prometer ganhos.
- **Respostas contraditórias:** apontar a contradição, sem escolher uma versão.
- **Seção final "Limites deste diagnóstico":** lista as perguntas não respondidas ou vagas que limitam a análise.

### 2. Nova versão do prompt no painel
Criar a versão 5 do prompt ativo reforçando as mesmas regras na estrutura dos capítulos (cada capítulo: "O que foi informado" -> "Leitura" -> "Pontos para aprofundar"), mantendo os quatro eixos e a seção de Prontidão para IA. A versão atual continua guardada no histórico.

### 3. Revisor alinhado
A revisão de qualidade passa a verificar explicitamente essas mesmas regras (recomendação sem "Com base em", hipóteses, números externos, tom categórico), para que o que o revisor cobra seja exatamente o que o gerador precisa cumprir.

## Validação
Regenerar o relatório do diagnóstico da Cupolab, rodar a revisão com IA e conferir que não aparecem recomendações ou hipóteses sem base.

## Detalhes técnicos
- `src/lib/gerar-relatorio.server.ts`: ampliar `REGRAS_FORMATO` para um bloco `REGRAS_DE_EVIDENCIA`, anexado depois do `prompt_sistema` e antes da base de conhecimento (fica dentro do prefixo em cache).
- Nova linha em `configuracoes_agente` (versao 5, ativo=true, desativando a anterior), mesmo modelo.
- `src/lib/auditoria.server.ts`: ajustar `INSTRUCOES` para checar as regras acima na seção 3.
