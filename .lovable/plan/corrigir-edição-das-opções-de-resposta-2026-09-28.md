# Corrigir edição das opções de resposta

## Problema
No editor de perguntas, cada campo de opção é identificado pelo próprio texto da opção. Ao digitar uma letra, o texto muda, o sistema entende que é um campo "novo", recria-o e o cursor sai do campo.

## Correção
Identificar cada campo de opção pela sua posição na lista, e não pelo texto. Assim o campo permanece o mesmo enquanto você digita.

## Detalhes técnicos
- `src/routes/_authenticated/admin_.perguntas.tsx`, linha 387: trocar `key={`${op}-${i}`}` por `key={i}`.
- Nenhuma mudança em banco ou lógica de salvamento.
