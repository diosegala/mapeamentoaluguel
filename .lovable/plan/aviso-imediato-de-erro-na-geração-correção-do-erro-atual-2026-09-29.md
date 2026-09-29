# Aviso imediato de erro na geração + correção do erro atual

## O que aconteceu
A tentativa das 21:30 da "Imobiliaria Teste" falhou com **"Falha na IA (524)"**. O código 524 significa que a Anthropic demorou demais para responder de uma só vez e a conexão caiu. Isso acontece em relatórios longos, porque hoje o sistema espera o texto inteiro ficar pronto antes de receber qualquer parte. Uma nova tentativa das 21:33 ainda está em andamento.

## O que será feito

1. **Corrigir a causa (queda por demora)**
   - O relatório passa a ser recebido aos poucos, em partes, enquanto a IA escreve. Isso mantém a conexão ativa e evita o erro 524.
   - As regras atuais continuam valendo: o relatório só é concluído quando a IA termina de fato, e os tokens usados continuam registrados.
   - Quedas passageiras (524, 529, 5xx e 429) ganham **uma** nova tentativa automática após alguns segundos. Erros de chave, de crédito ou de pedido inválido não são repetidos.

2. **Notificação imediata por e-mail**
   - Quando uma geração falhar, os administradores recebem na hora um e-mail pelo Resend com:
     - imobiliária, código e versão do relatório;
     - motivo do erro traduzido para uma linguagem simples (por exemplo, "A IA demorou demais para responder" ou "Chave da Anthropic inválida"), junto com o código técnico;
     - data e hora, e um link direto para o diagnóstico no painel.
   - Os destinatários ficam configuráveis na tela de E-mail do painel. Se nenhum for definido, o aviso vai para todos os administradores.
   - Observação: enquanto o domínio da cupola.com.br não estiver validado no Resend, o remetente provisório só consegue entregar para o e-mail dono da conta Resend.

3. **Aviso dentro do painel**
   - No painel de diagnósticos aparece uma faixa vermelha "X gerações com erro nas últimas 24h", com o motivo e um botão para regenerar.
   - O detalhe do diagnóstico mostra o motivo completo do erro em cada versão.

4. **Mensagem ao cliente**
   - O cliente continua vendo uma mensagem amigável e o botão "Tentar novamente", sem detalhes técnicos.

## Detalhes técnicos
- `gerar-relatorio.server.ts`: chamar `/v1/messages` com `stream: true` e acumular `text_delta`, `stop_reason` (em `message_delta`) e `usage` (em `message_start`/`message_delta`). Manter o loop de continuação por `max_tokens` e o prompt caching. Adicionar 1 retry com backoff em 429/5xx/524/529 e gravar em `erro` o status e a mensagem da Anthropic.
- `falhar()` passa a chamar `notificarErroGeracao()` (novo, em `email.server.ts`), dentro de try/catch para que uma falha no aviso nunca afete o registro do erro.
- Destinatários: nova chave em `configuracoes_email` (ou na tabela equivalente que já existe) para "e-mails de alerta"; fallback para os e-mails dos usuários com papel admin, obtidos via `supabaseAdmin.auth.admin`.
- `admin.functions.ts`: `errosRecentes()` com `garantirAdmin`, usado pela faixa em `admin.tsx`.
- Validação: forçar um erro controlado (modelo inválido em teste) para confirmar o e-mail e a faixa, e depois gerar o relatório da Imobiliaria Teste para confirmar que o 524 não se repete.
