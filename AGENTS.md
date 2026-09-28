<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Public client access goes only through src/lib/publico.functions.ts (code-validated, IP rate-limited via tentativas_codigo, service role); no anon RLS on diagnosticos/relatorios — prevents cross-client leaks.
- PDF do relatório é gerado no navegador via @media print em src/styles.css (capa .relatorio-capa, conteúdo .relatorio-conteudo); bibliotecas de PDF no servidor são incompatíveis com o runtime Worker.
- Relatórios Anthropic só são concluídos após `stop_reason=end_turn`; continuar respostas com `max_tokens` e somar uso de todas as chamadas para evitar publicar texto truncado.
