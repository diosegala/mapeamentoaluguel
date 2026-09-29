# Roadmap — Diagnóstico Cupola Aluguel

- [x] Design system CUPOLA (cores, tipografia, raio)
- [x] Página inicial com entrada de código
- [x] Componentes do formulário (botões de escolha, moeda, progresso, transição)
- [x] Conectar Supabase externo
- [x] Migrations: diagnosticos, relatorios, base_conhecimento, configuracoes_agente, perguntas_formulario, user_roles + RLS/GRANTs + seed
- [x] Chave ANTHROPIC_API_KEY (via painel)
- [x] Funções de servidor públicas por código + limite de tentativas + geração de relatório
- [x] Formulário dinâmico ligado ao banco
- [x] Página de relatório + detalhe/regeneração/envio no admin
- [x] Painel admin: login, dashboard, editor de perguntas, editor do prompt
- [x] Painel admin: base de conhecimento (links, sem limite)
- [x] Painel admin: chave da API + dashboard de uso (tokens/custo, filtros)
- [x] Versão PDF do relatório (impressão com capa, seções numeradas, rodapé)
- [x] Primeiro teste ponta a ponta: identificada interrupção por limite de tokens; geração agora exige fim confirmado e continua respostas longas
- [x] Nova geração completa do diagnóstico Cupolab confirmada: versão 2 concluída até as prioridades finais
- [x] Refinar prompt ativo e revisão: clareza, contas verificáveis, IA transversal, sem comparativos de mercado
- [ ] Validar relatório gerado sem enviar e-mail de teste ao cliente — depende de acesso administrativo ao Supabase externo; os diagnósticos existentes não contêm respostas às sete perguntas novas
- [x] Projeção da carteira pela fórmula da planilha CUPOLA (cálculo no servidor, prompt v8, regras anti-genérico)
