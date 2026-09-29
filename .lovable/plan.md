# Projeção da carteira com a fórmula CUPOLA + relatório menos genérico

## O problema
- A versão 7 do prompt proíbe a projeção sempre que "faltarem saídas efetivas". Por isso a IA disse que o questionário não permitia calcular, mesmo com todos os dados coletados. Isso deixa o cliente e a CUPOLA mal posicionados.
- O texto do sistema proíbe qualquer referência ao mercado. Com isso, a IA também recusa os percentuais de 30% e 60%.
- Os parágrafos explicam a metodologia ("este número descreve a rotatividade...") em vez de dizer ao cliente o que o número significa para ele.

## A fórmula da sua planilha (mês a mês, composta)
Os indicadores vêm do questionário:
- TDCA (taxa de desocupação) = desocupações por mês ÷ imóveis administrados
- ICCA (índice de captação) = captações por mês ÷ imóveis administrados
- TRID (relocação de imóveis desocupados) = 60%, referência CUPOLA
- TCNC (conversão de novas captações em contrato) = 30%, referência CUPOLA

```text
Carteira do mês = carteira anterior
                - carteira anterior x TDCA          (saem)
                + carteira anterior x TDCA x TRID   (desocupados que são relocados)
                + carteira anterior x ICCA x TCNC   (captações que viram contrato)

Isso equivale a multiplicar a carteira todo mês por
  fator = 1 - TDCA + TDCA x TRID + ICCA x TCNC
Carteira no mês 12 = carteira atual x fator^12
Taxa de crescimento = carteira no mês 12 ÷ carteira atual - 1
```
Conferência: com os dados da planilha (500 imóveis, 14 desocupações, ICCA 5%, TRID 78%, TCNC 25%), o resultado bate exatamente: 539,4 imóveis e crescimento de 7,9%.

**Captações necessárias para a meta** (a mesma lógica dos "Cenários de crescimento", só que em sentido inverso):
`fator necessário = (1 + meta)^(1/12)` → `ICCA necessário = (fator necessário − 1 + TDCA x (1 − TRID)) / TCNC` → `captações por mês = ICCA necessário x carteira`. Quando a meta vier em faixa, o cálculo é feito para os limites inferior e superior.

**A conta é feita pelo sistema, não pela IA.** O servidor calcula a projeção mês a mês, o crescimento e as captações necessárias e entrega os números prontos à IA, junto com a tabela dos 12 meses. A IA só interpreta esses números e fica proibida de refazer ou contestar a conta. Isso elimina erros de aritmética e as recusas do tipo "não é possível projetar".

## O que muda
1. **Cálculo no servidor:** uma nova rotina aplica a fórmula acima sempre que o diagnóstico tiver carteira, desocupações e captações preenchidas. O resultado entra no pedido à IA como um bloco "Projeção da carteira (calculada pela CUPOLA)".
2. **Prompt v8** (o histórico é preservado): sai a regra atual de "Dinâmica da carteira" e entram instruções para usar o bloco calculado. O texto deve explicar TDCA, ICCA, TRID e TCNC em linguagem simples, comparar o resultado com a meta e mostrar quantas captações por mês seriam necessárias. Os 30% e 60% são apresentados como "referências médias observadas pela CUPOLA".
3. **Regras fixas do gerador:** a proibição de comparar com o mercado continua, com uma exceção: a TRID e a TCNC de referência podem ser usadas. Entra uma nova regra: "se o questionário coletou o dado, nunca diga que ele não foi informado".
3. **Contra textos genéricos** (prompt e regras fixas):
   - Cada parágrafo abre com o número do cliente e diz o que ele significa para a operação dele. Explicar conceitos e metodologia fica proibido.
   - Frases que serviriam para qualquer imobiliária ficam proibidas. Toda afirmação precisa citar pelo menos uma resposta ou um número do cliente.
   - "Pontos a validar" fica reservado a causas e hipóteses, nunca a dados que o questionário já coleta.
4. **Revisão de qualidade:** passa a conhecer a fórmula e os percentuais, para não marcar como "inventado", e sinaliza textos genéricos e recusas indevidas de cálculo.
5. **Validação:** regenerar o relatório da Imobiliária Teste (sem enviar e-mail ao cliente) e conferir o número projetado e o tom.

## Detalhes técnicos
- Novo registro em `configuracoes_agente` (v8 ativa, v7 inativa), editando a seção "Dinâmica da carteira": sai a remoção de "Saldo mensal = locações − desocupações" como proxy de crescimento, entra a fórmula.
- `src/lib/gerar-relatorio.server.ts`: ajustar a regra de números e mercado, e acrescentar as regras anti-genérico.
- `src/lib/auditoria.server.ts`: incluir a fórmula e os percentuais aprovados no contexto do revisor.
- Durante o teste, o envio automático para o cliente fica bloqueado.
