import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODELO = "claude-haiku-4-5";

const INSTRUCOES = `Você é um auditor de qualidade da CUPOLA. Recebe os dados cadastrais da imobiliária, as respostas de um questionário de diagnóstico da operação de locação e o relatório gerado por IA a partir delas.
Os dados cadastrais (nome, cidade, estado e contato) são fatos válidos informados pela imobiliária: nunca aponte como invenção uma informação que conste neles.
Sua tarefa é revisar o relatório com rigor e apontar, em português do Brasil, somente problemas reais, conferindo cada apontamento contra os dados cadastrais e as respostas antes de escrevê-lo:

## 1. Inconsistências
Afirmações do relatório que contradizem as respostas, números calculados errados, ou respostas do cliente que se contradizem entre si.

## 2. Lacunas
Respostas relevantes ignoradas pelo relatório, seções superficiais, ou informações que faltam no questionário e limitam o diagnóstico.

## 3. Recomendações sem evidência e violações das regras
Aponte, citando o trecho:
- recomendações ou conclusões sem base nas respostas, ou sem a indicação "Com base em: ...";
- hipóteses ou suposições ("provavelmente", "é possível que", "deve estar");
- números que não vêm das respostas nem de cálculo direto entre elas (médias de mercado, referências externas);
- fatos sobre o cliente que não estão nos dados cadastrais nem nas respostas;
- tom categórico: afirmações definitivas sobre causas, resultados futuros ou promessas de ganho;
- ausência da seção "Limites deste diagnóstico".

## 4. Veredito
Um parágrafo curto: o relatório pode ser enviado ao cliente como está, com ajustes, ou precisa ser regenerado.

Regras: cite trechos curtos entre aspas e a pergunta/resposta correspondente. Seja objetivo, use listas. Se não houver problemas em uma seção, escreva "Nenhum ponto encontrado." Limite a resposta a cerca de 900 palavras.`;

async function chaveAnthropic(): Promise<string | null> {
  const doAmbiente = process.env["ANTHROPIC_API_KEY"] ?? "";
  if (doAmbiente.length > 10) return doAmbiente;
  const { data } = await supabaseAdmin.rpc("ler_segredo" as never, { p_nome: "ANTHROPIC_API_KEY" } as never);
  const guardada = (data as string | null) ?? "";
  return guardada.length > 10 ? guardada : null;
}

export async function auditarRelatorio(
  contexto: string,
  relatorio: string,
  registro: { diagnosticoId: string; relatorioId: string },
) {
  const chave = await chaveAnthropic();
  if (!chave) throw new Error("Chave da Anthropic não configurada. Cadastre-a na tela de API.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 4000,
      stream: true,
      system: INSTRUCOES,
      messages: [{ role: "user", content: `${contexto}\n\n# Relatório gerado\n\n${relatorio}` }],
    }),
  });

  if (!res.ok || !res.body) {
    const corpo = await res.text().catch(() => "");
    let msg = corpo;
    try { msg = JSON.parse(corpo)?.error?.message ?? corpo; } catch { /* texto */ }
    if (res.status === 401) throw new Error("Chave da Anthropic inválida.");
    if (res.status === 429) throw new Error("Limite de requisições da Anthropic atingido. Tente novamente em instantes.");
    throw new Error(`Falha na revisão (${res.status}): ${String(msg).slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let texto = "";
  let erro: string | null = null;
  let parada: string | null = null;
  let entrada = 0;
  let saida = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const dado = linha.slice(5).trim();
      if (!dado) continue;
      try {
        const ev = JSON.parse(dado);
        if (ev.type === "message_start") entrada = ev.message?.usage?.input_tokens ?? 0;
        else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") texto += ev.delta.text ?? "";
        else if (ev.type === "message_delta") {
          parada = ev.delta?.stop_reason ?? parada;
          saida = ev.usage?.output_tokens ?? saida;
        } else if (ev.type === "error") erro = ev.error?.message ?? "Falha na revisão.";
      } catch { /* ignora */ }
    }
  }

  await supabaseAdmin.from("auditorias" as never).insert({
    diagnostico_id: registro.diagnosticoId,
    relatorio_id: registro.relatorioId,
    modelo: MODELO,
    tokens_entrada: entrada,
    tokens_saida: saida,
  } as never);

  if (erro) throw new Error(erro);
  if (parada === "refusal") throw new Error("O modelo recusou fazer esta revisão.");
  if (!texto.trim()) throw new Error("O modelo não retornou conteúdo para a revisão.");
  return { conteudo: texto, modelo: MODELO };
}
