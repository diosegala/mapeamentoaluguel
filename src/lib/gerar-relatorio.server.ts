import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chamarComRetry, chaveAnthropic } from "@/lib/anthropic.server";
import { aplicarCorrecoes, registrarRevisao, revisarRelatorio } from "@/lib/auditoria.server";
import { blocosCalculados } from "@/lib/indicadores-operacao";

// A base inteira vai para o modelo (janela de 1M tokens). Acima deste teto a geração
// falha com aviso claro, em vez de cortar documentos em silêncio.
const LIMITE_BASE = 2_000_000;
// O raciocínio interno do modelo consome o mesmo limite do texto; folga evita continuações.
const MAX_TOKENS_RESPOSTA = 64_000;
const MAX_TRECHOS = 5;
// Gerações por relatório: a revisão pode pedir uma nova quando a estrutura sai comprometida.
const MAX_GERACOES = 2;
// Regras que valem para qualquer versão do prompt salva no painel.
const REGRAS_FIXAS = `

# Regras fixas do sistema
- Fatos sobre a imobiliária vêm somente de <imobiliaria>, <respostas>, <indicadores> e <projecao_carteira>. Os diagnósticos de outras imobiliárias na base de conhecimento são referência de método e profundidade: nunca transfira fatos, números ou nomes deles para este relatório.
- Os números de <indicadores> e <projecao_carteira> são oficiais: use-os como estão, sem refazer ou contestar. Só calcule o que esses blocos não trazem.
- Cada prioridade termina com "Com base em: ..." citando as respostas que a sustentam.
- Termine o relatório com a seção "## Limites deste diagnóstico".
- Escreva em português do Brasil, em Markdown (títulos ##, listas, tabelas e negrito). Não inclua aviso de que o texto foi gerado por IA; o sistema adiciona.`;

function escaparAtributo(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
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
    const { projecao, indicadores } = blocosCalculados(respostas);
    const dados = [
      `<imobiliaria>\nNome: ${diag.nome_imobiliaria}\nCidade: ${diag.cidade}/${diag.estado}\n</imobiliaria>`,
      `<respostas>\nRespostas do mapeamento, agrupadas pelas seções do formulário:\n${linhas.join("\n")}\n</respostas>`,
      ...(indicadores ? [`<indicadores>\n${indicadores}\n</indicadores>`] : []),
      ...(projecao ? [`<projecao_carteira>\n${projecao}\n</projecao_carteira>`] : []),
    ].join("\n\n");
    const usuario = `${dados}\n\nEscreva o relatório de diagnóstico.`;

    const modelo = cfg.modelo || "claude-sonnet-5";
    // O snapshot guarda só as instruções; os documentos usados ficam em documentos_usados.
    await supabaseAdmin
      .from("relatorios")
      .update({ prompt_snapshot: instrucoes, documentos_usados: usados, modelo })
      .eq("id", relatorioId);

    const uso = { entrada: 0, saida: 0, cacheCriacao: 0, cacheLeitura: 0 };
    const salvarUso = () =>
      supabaseAdmin
        .from("relatorios")
        .update({
          tokens_entrada: uso.entrada,
          tokens_saida: uso.saida,
          tokens_cache_criacao: uso.cacheCriacao,
          tokens_cache_leitura: uso.cacheLeitura,
        })
        .eq("id", relatorioId);

    /** Uma geração completa: continua respostas longas e só aceita texto encerrado com end_turn. */
    const gerar = async (): Promise<{ texto: string } | { erro: string }> => {
      const mensagens: Array<{ role: "user" | "assistant"; content: unknown }> = [
        { role: "user", content: usuario },
      ];
      const partes: string[] = [];
      for (let trecho = 0; trecho < MAX_TRECHOS; trecho++) {
        const r = await chamarComRetry(chave, {
          model: modelo,
          max_tokens: MAX_TOKENS_RESPOSTA,
          stream: true,
          system: sistemaBlocos,
          messages: mensagens,
        });
        uso.entrada += r.usage.input;
        uso.saida += r.usage.output;
        uso.cacheCriacao += r.usage.cacheCriacao;
        uso.cacheLeitura += r.usage.cacheLeitura;
        if (!r.ok) {
          console.error("Anthropic erro", r.status, r.erro);
          return { erro: `Falha na IA (${r.status}): ${r.erro}` };
        }
        partes.push(r.texto);
        if (r.stop === "end_turn") {
          const texto = partes.join("").trim();
          return texto ? { texto } : { erro: "A IA não retornou conteúdo." };
        }
        if (r.stop === "refusal") return { erro: "A IA recusou gerar o relatório (refusal)." };
        if (r.stop !== "max_tokens" || !r.texto) break;
        mensagens.push({ role: "assistant", content: [{ type: "text", text: r.texto }] });
        mensagens.push({ role: "user", content: "Continue exatamente de onde parou, sem repetir o texto anterior. Termine todas as seções do relatório." });
      }
      return { erro: "A IA interrompeu o relatório antes do final. Gere uma nova versão." };
    };

    // Revisão automática antes de publicar: corrige trechos pontuais e, se a estrutura
    // estiver comprometida, gera o relatório de novo uma única vez.
    let final = "";
    let original = "";
    for (let tentativa = 1; ; tentativa++) {
      const gerado = await gerar();
      if ("erro" in gerado) {
        await salvarUso();
        return falhar(gerado.erro);
      }
      const revisao = await revisarRelatorio({ chave, modelo, contexto: dados, relatorio: gerado.texto });
      const refazer = revisao.veredito === "regenerar" && tentativa < MAX_GERACOES;
      const corrigido = refazer ? { texto: gerado.texto, aplicadas: 0 } : aplicarCorrecoes(gerado.texto, revisao.problemas);
      await registrarRevisao({ diagnosticoId, relatorioId, revisao, aplicadas: corrigido.aplicadas, automatica: true });
      if (refazer) continue;
      original = gerado.texto;
      final = corrigido.texto;
      break;
    }

    await salvarUso();
    await supabaseAdmin
      .from("relatorios")
      .update({ status: "concluido", conteudo: final, conteudo_original: original, erro: null } as never)
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
