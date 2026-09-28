import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LIMITE_BASE = 18_000;
const MAX_TOKENS_RESPOSTA = 16_000;
const MAX_TRECHOS = 5;
const REGRAS_FORMATO = `

REGRAS DE FORMATO (obrigatórias):
- Escreva em português do Brasil, em Markdown, com títulos (##), listas e negrito quando útil.
- Não invente números que não estejam nas respostas.
- Não inclua o aviso de IA; ele é adicionado pelo sistema.`;

async function chaveAnthropic(): Promise<string | null> {
  const doAmbiente = process.env["ANTHROPIC_API_KEY"] ?? "";
  if (doAmbiente.length > 10) return doAmbiente;
  const { data } = await supabaseAdmin.rpc("ler_segredo" as never, {
    p_nome: "ANTHROPIC_API_KEY",
  } as never);
  const guardada = (data as string | null) ?? "";
  return guardada.length > 10 ? guardada : null;
}

function formatarValor(v: unknown): string {
  if (v == null || v === "") return "(sem resposta)";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** Cria o registro do relatório (status gerando) e devolve o id. */
export async function iniciarRelatorio(diagnosticoId: string) {
  const { data: ult } = await supabaseAdmin
    .from("relatorios")
    .select("versao")
    .eq("diagnostico_id", diagnosticoId)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("relatorios")
    .insert({ diagnostico_id: diagnosticoId, versao: (ult?.versao ?? 0) + 1, status: "gerando" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabaseAdmin
    .from("diagnosticos")
    .update({ status: "gerando_relatorio" })
    .eq("id", diagnosticoId);
  return data.id as string;
}

/** Executa a geração de um relatório já iniciado. Nunca lança; registra erro. */
export async function executarRelatorio(relatorioId: string) {
  const { data: rel } = await supabaseAdmin
    .from("relatorios")
    .select("id, status, diagnostico_id")
    .eq("id", relatorioId)
    .maybeSingle();
  if (!rel || rel.status !== "gerando") return;
  const diagnosticoId = rel.diagnostico_id;

  const falhar = async (msg: string) => {
    await supabaseAdmin.from("relatorios").update({ status: "erro", erro: msg }).eq("id", relatorioId);
    await supabaseAdmin.from("diagnosticos").update({ status: "erro_geracao" }).eq("id", diagnosticoId);
  };

  try {
    const [{ data: diag }, { data: cfg }, { data: docs }, { data: perguntas }] = await Promise.all([
      supabaseAdmin.from("diagnosticos").select("*").eq("id", diagnosticoId).single(),
      supabaseAdmin
        .from("configuracoes_agente")
        .select("prompt_sistema, modelo")
        .eq("ativo", true)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("base_conhecimento")
        .select("id, titulo, conteudo")
        .eq("ativo", true)
        .not("conteudo", "is", null)
        .order("ordem"),
      supabaseAdmin.from("perguntas_formulario").select("chave, texto, secao, ordem").order("secao").order("ordem"),
    ]);
    if (!diag) return falhar("Diagnóstico não encontrado.");
    if (!cfg) return falhar("Nenhum prompt ativo configurado.");
    const chave = await chaveAnthropic();
    if (!chave) return falhar("Chave da Anthropic não configurada.");

    let base = "";
    const usados: string[] = [];
    for (const d of docs ?? []) {
      if (base.length >= LIMITE_BASE) break;
      const trecho = `\n\n### ${d.titulo}\n${d.conteudo}`;
      base += trecho.slice(0, LIMITE_BASE - base.length);
      usados.push(d.id);
    }

    const sistema =
      cfg.prompt_sistema +
      REGRAS_FORMATO +
      (base ? `\n\nBASE DE CONHECIMENTO CUPOLA:${base}` : "");

    const respostas = (diag.respostas ?? {}) as Record<string, unknown>;
    const textos = new Map((perguntas ?? []).map((p) => [p.chave, p.texto]));
    const linhas: string[] = [];
    const vistos = new Set<string>();
    for (const p of perguntas ?? []) {
      if (!(p.chave in respostas)) continue;
      vistos.add(p.chave);
      let v = formatarValor(respostas[p.chave]);
      const outro = respostas[`${p.chave}__outro`];
      if (outro) v += ` (Outro: ${outro})`;
      linhas.push(`- ${p.texto}: ${v}`);
    }
    for (const [k, v] of Object.entries(respostas)) {
      if (vistos.has(k) || k.endsWith("__outro")) continue;
      linhas.push(`- ${textos.get(k) ?? k}: ${formatarValor(v)}`);
    }
    const usuario = `Imobiliária: ${diag.nome_imobiliaria}\nCidade: ${diag.cidade}/${diag.estado}\n\nRespostas do mapeamento:\n${linhas.join("\n")}\n\nEscreva o relatório de diagnóstico.`;

    const modelo = cfg.modelo || "claude-sonnet-5";
    await supabaseAdmin
      .from("relatorios")
      .update({ prompt_snapshot: sistema, documentos_usados: usados, modelo })
      .eq("id", relatorioId);

    const mensagens: Array<{ role: "user" | "assistant"; content: unknown }> = [
      { role: "user", content: usuario },
    ];
    const partes: string[] = [];
    let tokensEntrada = 0;
    let tokensSaida = 0;
    let finalizado = false;

    let tokensCacheCriacao = 0;
    let tokensCacheLeitura = 0;

    for (let trecho = 0; trecho < MAX_TRECHOS; trecho++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": chave,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: MAX_TOKENS_RESPOSTA,
          system: [
            {
              type: "text",
              text: sistema,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: mensagens,
        }),
      });
      const json: any = await resp.json().catch(() => null);
      if (!resp.ok) {
        console.error("Anthropic erro", resp.status, json);
        await supabaseAdmin.from("relatorios").update({ tokens_entrada: tokensEntrada, tokens_saida: tokensSaida }).eq("id", relatorioId);
        return falhar(`Falha na IA (${resp.status}): ${json?.error?.message ?? "erro desconhecido"}`);
      }

      tokensEntrada += json?.usage?.input_tokens ?? 0;
      tokensCacheCriacao += json?.usage?.cache_creation_input_tokens ?? 0;
      tokensCacheLeitura += json?.usage?.cache_read_input_tokens ?? 0;
      tokensSaida += json?.usage?.output_tokens ?? 0;
      const blocos = Array.isArray(json?.content) ? json.content : [];
      const textoTrecho = blocos
        .filter((c: { type?: string }) => c.type === "text")
        .map((c: { text?: string }) => c.text ?? "")
        .join("");
      partes.push(textoTrecho);

      if (json?.stop_reason === "end_turn") {
        finalizado = true;
        break;
      }
      if (json?.stop_reason !== "max_tokens" || blocos.length === 0) break;

      // Reenvia os blocos originais, inclusive eventuais assinaturas de pensamento,
      // para a Anthropic continuar sem recomeçar nem duplicar o texto anterior.
      mensagens.push({ role: "assistant", content: blocos });
      mensagens.push({ role: "user", content: "Continue exatamente de onde parou, sem repetir o texto anterior. Termine todas as seções do relatório." });
    }

    await supabaseAdmin.from("relatorios").update({ tokens_entrada: tokensEntrada, tokens_saida: tokensSaida, tokens_cache_criacao: tokensCacheCriacao, tokens_cache_leitura: tokensCacheLeitura }).eq("id", relatorioId);
    if (!finalizado) return falhar("A IA interrompeu o relatório antes do final. Gere uma nova versão.");
    const texto = partes.join("").trim();
    if (!texto) return falhar("A IA não retornou conteúdo.");

    await supabaseAdmin
      .from("relatorios")
      .update({
        status: "concluido",
        conteudo: texto,
        erro: null,
         tokens_entrada: tokensEntrada,
         tokens_saida: tokensSaida,
         tokens_cache_criacao: tokensCacheCriacao,
         tokens_cache_leitura: tokensCacheLeitura,
      })
      .eq("id", relatorioId);
    await supabaseAdmin
      .from("diagnosticos")
      .update({ status: "concluido", concluido_em: diag.concluido_em ?? new Date().toISOString() })
      .eq("id", diagnosticoId);
  } catch (e) {
    console.error("gerar relatório", e);
    await falhar("Erro inesperado ao gerar o relatório.");
    return;
  }

  // Envio automático ao cliente (apenas na primeira versão concluída).
  try {
    const { count } = await supabaseAdmin
      .from("relatorios")
      .select("id", { count: "exact", head: true })
      .eq("diagnostico_id", diagnosticoId)
      .eq("status", "concluido");
    if ((count ?? 0) === 1) {
      const { enviarRelatorioDiagnostico } = await import("./email.server");
      const r = await enviarRelatorioDiagnostico({ diagnosticoId, relatorioId, automatico: true });
      if (!r.ok && !r.pulado) console.error("envio automático", r.erro);
    }
  } catch (e) {
    console.error("envio automático", e);
  }
}
