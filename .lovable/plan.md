# Revisão de qualidade com Claude Haiku (API própria da Anthropic)

## O que muda
- A revisão de qualidade passa a usar o **Claude Haiku 4.5**, pela mesma chave da Anthropic já cadastrada no painel (a que gera os relatórios). O AI Gateway deixa de ser usado nessa revisão.
- O revisor passa a receber os **dados cadastrais** da imobiliária (nome, cidade, estado e contato do questionário), acabando com falsos apontamentos como "localização inventada".
- As instruções do revisor ganham uma regra: dados do cadastro são fatos válidos e não devem ser apontados como invenção.
- O custo da revisão passa a aparecer no painel de uso da API (tokens e valor), identificado como revisão.
- Se a chave não estiver configurada, o botão mostra uma mensagem clara.

## Detalhes técnicos
- `src/lib/auditoria.server.ts`: trocar a chamada ao Gateway por `POST https://api.anthropic.com/v1/messages` com `x-api-key` (lida via a mesma função do Vault usada em `gerar-relatorio.server.ts`, extraída para helper compartilhado), modelo `claude-haiku-4-5`, `stream: true`, `max_tokens` 4000, `system` com as instruções; ler SSE (`text_delta`, `message_delta.usage`, `stop_reason`), tratar `refusal`, 401/402/429/5xx sem retry automático.
- `src/lib/admin.functions.ts` (`auditarRelatorioIa`): buscar também `cidade`, `estado` e respostas de contato; montar cabeçalho "Dados cadastrais" antes das respostas.
- Registrar uso (tokens entrada/saída, modelo) para o dashboard em `uso.functions.ts`; se o dashboard só lê `relatorios`, adicionar tabela `auditorias` (diagnostico_id, relatorio_id, modelo, tokens, created_at, com GRANT + RLS admin) e incluí-la nos totais.
- Atualizar o texto da UI para "Revisão feita por Claude Haiku".
