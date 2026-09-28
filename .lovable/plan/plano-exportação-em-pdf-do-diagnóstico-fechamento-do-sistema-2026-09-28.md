# Plano — Exportação em PDF do diagnóstico + fechamento do sistema

## Objetivo
Transformar o relatório (hoje apenas uma página HTML) em um documento PDF baixável, com visual inspirado no "Panorama do Corretor Imobiliário 2026" (capa, seções numeradas, tabelas, insights destacados, recomendações), e fechar os últimos itens para o sistema funcionar de ponta a ponta.

## O que será feito

### 1. Versão para impressão/PDF do relatório
- Botão "Baixar PDF" na página do relatório (`/relatorio/:codigo`) e na tela de detalhe do diagnóstico no painel admin.
- Implementação via folha de estilos de impressão (o navegador gera o PDF em "Imprimir → Salvar como PDF"). É a abordagem mais segura nesta plataforma: bibliotecas de PDF no servidor não são compatíveis com o ambiente de execução.
- Layout de impressão dedicado, inspirado no PDF de referência:
  - Capa com marca CUPOLA, título do diagnóstico, nome da imobiliária e data.
  - Seções numeradas com títulos em destaque.
  - Tabelas formatadas e blocos de "INSIGHT" com destaque visual.
  - Cabeçalho/rodapé de página com numeração.
  - Cores e tipografia do design system CUPOLA.
- Na impressão, esconder botões, navegação e elementos interativos.

### 2. Fechamento do fluxo
- Garantir que a geração do relatório use o **modelo selecionado na aba Prompt** (hoje o campo existe; confirmar que a função de geração o consome — corrigir se não consumir).
- Botão "Regenerar relatório" no detalhe do diagnóstico (admin), registrando novo uso de tokens no dashboard da API.
- Teste de ponta a ponta com um diagnóstico de exemplo: criar código → preencher formulário → gerar → visualizar → imprimir PDF.

## Fora de escopo (confirmar se deseja depois)
- Envio automático do relatório por e-mail ao cliente (exige provedor de e-mail transacional; hoje o envio é manual via link/WhatsApp).
- Upload do PDF de referência na Base de Conhecimento (a base aceita apenas links de Google Docs; o PDF enviado será usado como referência visual, não como conteúdo da base).

## Detalhes técnicos
- CSS de impressão em `src/styles.css` com `@media print` e `page-break` rules; nenhuma dependência nova no servidor.
- A página do relatório ganha classe `print:...` (Tailwind) para alternar entre versão de tela e versão documento.
- Verificação: `tsgo --noEmit`, build, e inspeção visual do PDF gerado via Playwright (print-to-pdf no Chromium) comparando com o PDF de referência.
- Segurança inalterada: o PDF é gerado no navegador de quem já tem o código válido; nenhum dado novo é exposto.
