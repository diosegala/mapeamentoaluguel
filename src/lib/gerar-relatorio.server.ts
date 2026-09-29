import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { blocoProjecao, metasDoTexto, projetarCarteira } from "@/lib/projecao-carteira";

// A base inteira vai para o modelo (janela de 1M tokens). Acima deste teto a geração
// falha com aviso claro, em vez de cortar documentos em silêncio.
const LIMITE_BASE = 2_000_000;
// O raciocínio interno do modelo consome o mesmo limite do texto; folga evita continuações.
const MAX_TOKENS_RESPOSTA = 64_000;
const MAX_TRECHOS = 5;
// Regras que valem para qualquer versão do prompt salva no painel.
const REGRAS_FIXAS = `

# Regras fixas do sistema
- Fatos sobre a imobiliária vêm somente de <imobiliaria>, <respostas> e <projecao_carteira>. Os diagnósticos de outras imobiliárias na base de conhecimento são referência de método e profundidade: nunca transfira fatos, números ou nomes deles para este relatório.
- Os números de <projecao_carteira> são oficiais: use-os como estão, sem refazer ou contestar.
- Cada prioridade termina com "Com base em: ..." citando as respostas que a sustentam.
- Termine o relatório com a seção "## Limites deste diagnóstico".
- Escreva em português do Brasil, em Markdown (títulos ##, listas, tabelas e negrito). Não inclua aviso de que o texto foi gerado por IA; o sistema adiciona.`;

function escaparAtributo(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

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

type ResultadoStream = {
  ok: boolean;
  status: number;
  erro: string;
  transitorio: boolean;
  recebeuTexto: boolean;
  texto: string;
  stop: string | null;
  usage: { input: number; output: number; cacheCriacao: number; cacheLeitura: number };
};

/** Chama a Anthropic em streaming (mantém a conexão ativa e evita 524). */
async function chamarAnthropicStream(chave: string, corpo: unknown): Promise<ResultadoStream> {
  const res: ResultadoStream = {
    ok: false, status: 0, erro: "", transitorio: false, recebeuTexto: false, texto: "", stop: null,
    usage: { input: 0, output: 0, cacheCriacao: 0, cacheLeitura: 0 },
  };
  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    res.erro = `sem conexão com a Anthropic (${(e as Error).message})`;
    res.transitorio = true;
    return res;
  }
  res.status = resp.status;
  if (!resp.ok || !resp.body) {
    const json: any = await resp.json().catch(() => null);
    res.erro = json?.error?.message ?? "erro desconhecido";
    res.transitorio = resp.status === 429 || resp.status >= 500;
    return res;
  }
  const leitor = resp.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const linha = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!linha) continue;
        let ev: any;
        try { ev = JSON.parse(linha.slice(5).trim()); } catch { continue; }
        if (ev.type === "message_start") {
          const u = ev.message?.usage ?? {};
          res.usage.input += u.input_tokens ?? 0;
          res.usage.cacheCriacao += u.cache_creation_input_tokens ?? 0;
          res.usage.cacheLeitura += u.cache_read_input_tokens ?? 0;
          res.usage.output += u.output_tokens ?? 0;
        } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          res.texto += ev.delta.text ?? "";
          res.recebeuTexto = true;
        } else if (ev.type === "message_delta") {
          if (ev.delta?.stop_reason) res.stop = ev.delta.stop_reason;
          if (ev.usage?.output_tokens != null) res.usage.output = ev.usage.output_tokens;
        } else if (ev.type === "error") {
          res.erro = ev.error?.message ?? "erro no streaming";
          res.transitorio = ["overloaded_error", "api_error"].includes(ev.error?.type);
          res.status = ev.error?.type === "overloaded_error" ? 529 : 500;
          return res;
        }
      }
    }
  } catch (e) {
    res.erro = `conexão interrompida (${(e as Error).message})`;
    res.transitorio = true;
    res.status = 599;
    return res;
  }
  res.ok = true;
  return res;
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
    try {
      const { notificarErroGeracao } = await import("./email.server");
      await notificarErroGeracao({ diagnosticoId, relatorioId, erro: msg });
    } catch (e) {
      console.error("aviso de erro", e);
    }
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

    const usados: string[] = [];
    const documentos: string[] = [];
    for (const d of docs ?? []) {
      documentos.push(`<documento titulo="${escaparAtributo(d.titulo)}">\n${d.conteudo}\n</documento>`);
      usados.push(d.id);
    }
    const base = documentos.length
      ? `<base_conhecimento>\n${documentos.join("\n\n")}\n</base_conhecimento>`
      : "";
    if (base.length > LIMITE_BASE)
      return falhar(
        `A base de conhecimento ativa tem ${base.length} caracteres, acima do limite de ${LIMITE_BASE}. Desative documentos no painel.`,
      );

    const instrucoes = cfg.prompt_sistema + REGRAS_FIXAS;
    // Base primeiro: é grande e estável, então o cache continua valendo quando o prompt muda.
    const sistemaBlocos = [
      ...(base ? [{ type: "text", text: base, cache_control: { type: "ephemeral" } }] : []),
      { type: "text", text: instrucoes, cache_control: { type: "ephemeral" } },
    ];

    const respostas = (diag.respostas ?? {}) as Record<string, unknown>;
    const { data: secoesDb } = await (supabaseAdmin as any)
      .from("secoes_formulario")
      .select("numero, nome")
      .order("numero");
    const nomesSecoes = new Map<number, string>(
      ((secoesDb ?? []) as Array<{ numero: number; nome: string }>).map((s) => [s.numero, s.nome]),
    );
    const textos = new Map((perguntas ?? []).map((p) => [p.chave, p.texto]));
    const linhas: string[] = [];
    const vistos = new Set<string>();
    let secaoAtual: number | null = null;
    for (const p of perguntas ?? []) {
      if (!(p.chave in respostas)) continue;
      vistos.add(p.chave);
      if (p.secao !== secaoAtual) {
        secaoAtual = p.secao;
        linhas.push(`\n## ${nomesSecoes.get(p.secao) ?? `Seção ${p.secao}`}`);
      }
      let v = formatarValor(respostas[p.chave]);
      const outro = respostas[`${p.chave}__outro`];
      if (outro) v += ` (Outro: ${outro})`;
      linhas.push(`- ${p.texto}: ${v}`);
    }
    const extras: string[] = [];
    for (const [k, v] of Object.entries(respostas)) {
      if (vistos.has(k) || k.endsWith("__outro")) continue;
      extras.push(`- ${textos.get(k) ?? k}: ${formatarValor(v)}`);
    }
    if (extras.length) linhas.push("\n## Outras respostas", ...extras);
    const projecao = blocoProjecao(
      projetarCarteira({
        carteira: respostas["imoveis_administrados"],
        desocupacoes: respostas["desocupacoes_mes"],
        captacoes: respostas["captacoes_mes"],
        metas: metasDoTexto(respostas["meta_12_meses"]),
      }),
    );
    const usuario = [
      `<imobiliaria>\nNome: ${diag.nome_imobiliaria}\nCidade: ${diag.cidade}/${diag.estado}\n</imobiliaria>`,
      `<respostas>\nRespostas do mapeamento, agrupadas pelas seções do formulário:\n${linhas.join("\n")}\n</respostas>`,
      ...(projecao ? [`<projecao_carteira>\n${projecao}\n</projecao_carteira>`] : []),
      "Escreva o relatório de diagnóstico.",
    ].join("\n\n");

    const modelo = cfg.modelo || "claude-sonnet-5";
    // O snapshot guarda só as instruções; os documentos usados ficam em documentos_usados.
    await supabaseAdmin
      .from("relatorios")
      .update({ prompt_snapshot: instrucoes, documentos_usados: usados, modelo })
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
      const corpo = {
        model: modelo,
        max_tokens: MAX_TOKENS_RESPOSTA,
        stream: true,
        system: sistemaBlocos,
        messages: mensagens,
      };
      let r = await chamarAnthropicStream(chave, corpo);
      if (!r.ok && r.transitorio && !r.recebeuTexto) {
        await new Promise((ok) => setTimeout(ok, 5000));
        r = await chamarAnthropicStream(chave, corpo);
      }
      tokensEntrada += r.usage.input;
      tokensCacheCriacao += r.usage.cacheCriacao;
      tokensCacheLeitura += r.usage.cacheLeitura;
      tokensSaida += r.usage.output;
      if (!r.ok) {
        console.error("Anthropic erro", r.status, r.erro);
        await supabaseAdmin.from("relatorios").update({ tokens_entrada: tokensEntrada, tokens_saida: tokensSaida, tokens_cache_criacao: tokensCacheCriacao, tokens_cache_leitura: tokensCacheLeitura }).eq("id", relatorioId);
        return falhar(`Falha na IA (${r.status}): ${r.erro}`);
      }
      partes.push(r.texto);

      if (r.stop === "end_turn") {
        finalizado = true;
        break;
      }
      if (r.stop === "refusal") return falhar("A IA recusou gerar o relatório (refusal).");
      if (r.stop !== "max_tokens" || !r.texto) break;

      mensagens.push({ role: "assistant", content: [{ type: "text", text: r.texto }] });
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
