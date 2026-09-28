const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODELO = "openai/gpt-6-astra";

const INSTRUCOES = `Você é um auditor de qualidade da CUPOLA. Recebe as respostas de um questionário de diagnóstico da operação de locação de uma imobiliária e o relatório gerado por IA a partir delas.
Sua tarefa é revisar o relatório com rigor e apontar, em português do Brasil, somente problemas reais:

## 1. Inconsistências
Afirmações do relatório que contradizem as respostas, números calculados errados, ou respostas do cliente que se contradizem entre si.

## 2. Lacunas
Respostas relevantes ignoradas pelo relatório, seções superficiais, ou informações que faltam no questionário e limitam o diagnóstico.

## 3. Recomendações sem evidência e violações das regras
Aponte, citando o trecho:
- recomendações ou conclusões sem base nas respostas, ou sem a indicação "Com base em: ...";
- hipóteses ou suposições ("provavelmente", "é possível que", "deve estar");
- números que não vêm das respostas nem de cálculo direto entre elas (médias de mercado, referências externas);
- fatos sobre o cliente tirados da base de conhecimento e não das respostas;
- tom categórico: afirmações definitivas sobre causas, resultados futuros ou promessas de ganho;
- ausência da seção "Limites deste diagnóstico".

## 4. Veredito
Um parágrafo curto: o relatório pode ser enviado ao cliente como está, com ajustes, ou precisa ser regenerado.

Regras: cite trechos curtos entre aspas e a pergunta/resposta correspondente. Seja objetivo, use listas. Se não houver problemas em uma seção, escreva "Nenhum ponto encontrado." Limite a resposta a cerca de 900 palavras.`;

export async function auditarRelatorio(respostasTexto: string, relatorio: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Chave do AI Gateway não configurada.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODELO,
      instructions: INSTRUCOES,
      input: `# Respostas do questionário\n\n${respostasTexto}\n\n# Relatório gerado\n\n${relatorio}`,
      stream: true,
      store: false,
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });

  if (!res.ok || !res.body) {
    const corpo = await res.text().catch(() => "");
    let msg = corpo;
    try { msg = JSON.parse(corpo)?.error?.message ?? JSON.parse(corpo)?.message ?? corpo; } catch { /* texto */ }
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    throw new Error(`Falha na auditoria (${res.status}): ${String(msg).slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let texto = "";
  let erro: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const dado = linha.slice(5).trim();
      if (!dado || dado === "[DONE]") continue;
      try {
        const ev = JSON.parse(dado);
        if (ev.type === "response.output_text.delta") texto += ev.delta ?? "";
        else if (ev.type === "response.failed" || ev.type === "error")
          erro = ev.response?.error?.message ?? ev.message ?? "Falha na auditoria.";
      } catch { /* ignora */ }
    }
  }
  if (erro) throw new Error(erro);
  if (!texto.trim()) throw new Error("O modelo não retornou conteúdo para a auditoria.");
  return { conteudo: texto, modelo: MODELO };
}
