# Projeção da carteira com a fórmula CUPOLA + relatório menos genérico

## O problema
- A versão 7 do prompt proíbe a projeção sempre que "faltarem saídas efetivas". Por isso a IA disse que o questionário não permitia calcular, mesmo com todos os dados coletados. Isso deixa o cliente e a CUPOLA mal posicionados.
- O texto do sistema proíbe qualquer referência ao mercado. Com isso, a IA também recusa os percentuais de 30% e 60%.
- Os parágrafos explicam a metodologia ("este número descreve a rotatividade...") em vez de dizer ao cliente o que o número significa para ele.

## A fórmula (confirme se é esta a leitura)
Todos os valores são mensais e vêm do questionário: carteira = `imoveis_administrados`, captações = `captacoes_mes`, desocupações = `desocupacoes_mes`.

```text
Variação mensal = captações x 30%  (captações que viram contrato)
                - desocupações     (imóveis que saem)
                + desocupações x 60% (imóveis desocupados que são relocados)
                = captações x 0,30 - desocupações x 0,40

Carteira em 12 meses = carteira atual + 12 x variação mensal
Crescimento % = (carteira em 12 meses - carteira atual) / carteira atual
```
Exemplo com o teste (20 captações, 16 desocupações): 6 − 6,4 = −0,4 imóvel/mês. Em 12 meses, isso dá cerca de −5 imóveis. A carteira fica praticamente estável e longe da meta de 11% a 20%.

Em seguida, a IA compara com a meta e mostra as captações mensais necessárias:
`captações necessárias = (carteira x meta% / 12 + desocupações x 0,40) / 0,30`, com os limites inferior e superior quando a meta vier em faixa.

## O que muda
1. **Prompt v8** (o histórico é preservado): a regra de projeção passa a usar a fórmula acima. A IA fica proibida de dizer que falta dado quando as três respostas existem. A conta aparece em linguagem simples, e os 30% e 60% são apresentados como "referências médias observadas pela CUPOLA".
2. **Regras fixas do gerador:** a proibição de comparar com o mercado continua, com uma exceção: os dois percentuais da fórmula oficial podem ser usados. Entra uma nova regra: "se o questionário coletou o dado, nunca diga que ele não foi informado".
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
