# Novo prompt da IA alinhado à nova estrutura

O prompt ativo (versão 3) ainda espelha o formulário antigo de 6 seções e trata IA como capítulo isolado. Este plano reescreve o prompt para refletir as 4 novas seções do formulário, os 7 pilares do Método CUPOLA e o papel do diagnóstico como base da jornada (encontros online + imersão presencial).

## O que muda no prompt (nova versão 4)

1. **Contexto do produto** — novo trecho explicando que o diagnóstico é o ponto de partida da Imersão Cupola Aluguel: o relatório será usado pelo gestor e pelos consultores nos encontros online e na imersão presencial. O relatório deve funcionar como um mapa que a jornada vai aprofundar, sem vender nem prometer o produto.

2. **Estrutura do relatório alinhada aos 3 eixos de gestão** — as seções analíticas passam a ser:
   - Gestão Estratégica (estratégia do negócio, pessoas, marketing)
   - Gestão Comercial (captação de proprietários/imóveis, atendimento comercial)
   - Gestão Administrativa e Financeira (gestão administrativa, gestão financeira)
   - Em cada eixo, tecnologia e IA entram como parte da análise, não como capítulo separado: como os sistemas e o uso de IA sustentam ou travam aquele eixo.

3. **IA transversal** — o capítulo "Inteligência Artificial" sai da estrutura fixa. Os cruzamentos de IA (uso individual vs. estruturado, expectativa vs. realidade, política de IA) passam a alimentar a análise dentro de cada eixo e um novo bloco curto "Prontidão para IA", que avalia onde a operação está apta a aplicar IA com resultado e onde faltam fundamentos (dados, processos, canais).

4. **Conexão com a jornada** — a seção de Prioridades ganha uma orientação: indicar, para cada ação, qual pilar do Método CUPOLA ela fortalece. Isso prepara o terreno para os encontros online sem citar cronograma nem fazer propaganda.

5. **Mantido sem mudança** — os cálculos de indicadores derivados, as checagens de consistência, os cruzamentos entre respostas (ajustados apenas nos nomes das seções), o confronto meta vs. realidade, a seção "Percepção e realidade", "Pontos a validar", o estilo e as regras finais. Essas partes estão boas e são independentes da estrutura de seções.

## Nova estrutura do relatório (markdown)

```text
Título: Diagnóstico da Operação de Locação | {nome da imobiliária}
1. Leitura geral
2. Os números da operação (tabela Indicador | Valor | Leitura)
3. A carteira sustenta a meta?
4. Gestão Estratégica
5. Gestão Comercial
6. Gestão Administrativa e Financeira
7. Prontidão para IA
8. Percepção e realidade
9. Pontos a validar (omitir se vazio)
10. Prioridades (3 a 5 ações, cada uma ligada a um pilar do Método CUPOLA)
```

## Implementação

1. Inserir a nova versão do prompt em `configuracoes_agente` (versão 4, ativa, desativando a 3) via migration, mantendo o modelo `claude-sonnet-5`.
2. Nenhuma mudança de código é necessária: `gerar-relatorio.server.ts` já lê o prompt ativo e já agrupa as respostas pelas seções dinâmicas do banco.
3. Teste: regenerar o relatório de um diagnóstico existente pelo painel admin e conferir se a nova estrutura aparece e se nenhuma seção ficou vazia ou genérica.

## Fora deste escopo
- Mudanças no layout visual do relatório (capa, PDF).
- Edição do conteúdo das perguntas (o usuário fará durante o dia).
