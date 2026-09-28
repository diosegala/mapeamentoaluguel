import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6,8}$/);

const MSG_INVALIDO = "Código inválido ou temporariamente bloqueado. Confira o código ou aguarde alguns minutos.";

async function ipHash() {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    "desconhecido";
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`cupola:${ip}`),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Valida o código com limite de tentativas. Devolve o diagnóstico ou lança erro genérico. */
async function buscarPorCodigo(codigoBruto: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await ipHash();
  const desde15 = new Date(Date.now() - 15 * 60_000).toISOString();
  const desde30 = new Date(Date.now() - 30 * 60_000).toISOString();

  const { data: erros } = await supabaseAdmin
    .from("tentativas_codigo")
    .select("created_at")
    .eq("ip_hash", hash)
    .eq("sucesso", false)
    .gte("created_at", desde30)
    .order("created_at", { ascending: false });
  const lista = erros ?? [];
  const recentes = lista.filter((e) => e.created_at >= desde15).length;
  if (recentes >= 5 || lista.length >= 5) throw new Error(MSG_INVALIDO);

  const parsed = codigoSchema.safeParse(codigoBruto);
  let diag: any = null;
  if (parsed.success) {
    const { data } = await supabaseAdmin
      .from("diagnosticos")
      .select("id, codigo, nome_imobiliaria, status, secao_atual, respostas, iniciado_em")
      .eq("codigo", parsed.data)
      .maybeSingle();
    diag = data;
  }
  if (!diag) {
    await supabaseAdmin.from("tentativas_codigo").insert({ ip_hash: hash, sucesso: false });
    throw new Error(MSG_INVALIDO);
  }
  return { supabaseAdmin, diag };
}

const entradaCodigo = (d: unknown) => z.object({ codigo: z.string().max(12) }).parse(d);

export const abrirDiagnostico = createServerFn({ method: "POST" })
  .inputValidator(entradaCodigo)
  .handler(async ({ data }) => {
    let achado;
    try { achado = await buscarPorCodigo(data.codigo); } catch (e) { return { erro: (e as Error).message } as const; }
    const { supabaseAdmin, diag } = achado;
    const { data: perguntas } = await supabaseAdmin
      .from("perguntas_formulario")
      .select("chave, secao, texto, descricao, tipo, opcoes, permite_outro, obrigatoria, ordem")
      .eq("ativo", true)
      .order("secao")
      .order("ordem");
    const { data: secoesDb } = await (supabaseAdmin as any)
      .from("secoes_formulario")
      .select("numero, nome");
    const nomesSecoes: Record<number, string> = {};
    for (const s of (secoesDb ?? []) as { numero: number; nome: string }[]) nomesSecoes[s.numero] = s.nome;
    if (!diag.iniciado_em && diag.status === "nao_iniciado") {
      await supabaseAdmin
        .from("diagnosticos")
        .update({ status: "em_andamento", iniciado_em: new Date().toISOString() })
        .eq("id", diag.id);
    }
    return {
      erro: null,
      codigo: diag.codigo as string,
      nome: diag.nome_imobiliaria as string,
      status: diag.status as string,
      secao_atual: diag.secao_atual as number,
      nomesSecoes,
      respostas: (diag.respostas ?? {}) as Record<string, string | number | string[] | null>,
      perguntas: (perguntas ?? []) as Array<{
        chave: string;
        secao: number;
        texto: string;
        descricao: string | null;
        tipo: string;
        opcoes: string[];
        permite_outro: boolean;
        obrigatoria: boolean;
        ordem: number;
      }>,
    };
  });

const FINALIZADOS = ["gerando_relatorio", "concluido", "erro_geracao"];

export const salvarSecao = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        codigo: z.string().max(12),
        secao: z.number().int().min(1).max(10000),
        proxima: z.number().int().min(1).max(10001),
        respostas: z.record(
          z.string().max(120),
          z.union([
            z.string().max(4000),
            z.number().min(0).max(1e12),
            z.array(z.string().max(300)).max(50),
            z.null(),
          ]),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, diag } = await buscarPorCodigo(data.codigo);
    if (FINALIZADOS.includes(diag.status)) throw new Error("Este diagnóstico já foi enviado.");

    const { data: perguntas } = await supabaseAdmin
      .from("perguntas_formulario")
      .select("chave, tipo, obrigatoria")
      .eq("ativo", true)
      .eq("secao", data.secao);
    const permitidas = new Set<string>();
    for (const p of perguntas ?? []) {
      permitidas.add(p.chave);
      permitidas.add(`${p.chave}__outro`);
      const v = data.respostas[p.chave];
      const vazio = v == null || v === "" || (Array.isArray(v) && v.length === 0);
      if (p.obrigatoria && vazio) throw new Error("Responda todas as perguntas obrigatórias.");
      if ((p.tipo === "numero" || p.tipo === "moeda") && !vazio && typeof v !== "number")
        throw new Error("Valores numéricos inválidos.");
    }
    const limpas: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.respostas)) if (permitidas.has(k)) limpas[k] = v;

    const { error } = await supabaseAdmin
      .from("diagnosticos")
      .update({
        respostas: { ...(diag.respostas ?? {}), ...limpas },
        secao_atual: Math.max(diag.secao_atual ?? 1, data.proxima),
        status: "em_andamento",
      })
      .eq("id", diag.id);
    if (error) throw new Error("Não foi possível salvar. Tente novamente.");
    return { ok: true };
  });

/** Encerra o preenchimento e cria o relatório (limite de 3 por hora). */
export const concluirEGerar = createServerFn({ method: "POST" })
  .inputValidator(entradaCodigo)
  .handler(async ({ data }) => {
    const { supabaseAdmin, diag } = await buscarPorCodigo(data.codigo);
    if (diag.status === "concluido") return { ok: true, jaConcluido: true };
    if (diag.status === "gerando_relatorio") return { ok: true };
    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("relatorios")
      .select("id", { count: "exact", head: true })
      .eq("diagnostico_id", diag.id)
      .gte("created_at", umaHora);
    if ((count ?? 0) >= 3)
      throw new Error("Limite de tentativas atingido. Tente novamente em uma hora ou fale com a CUPOLA.");
    if (!diag.respostas || Object.keys(diag.respostas).length === 0)
      throw new Error("Nenhuma resposta registrada.");
    await supabaseAdmin
      .from("diagnosticos")
      .update({ concluido_em: new Date().toISOString() })
      .eq("id", diag.id);
    const { iniciarRelatorio } = await import("./gerar-relatorio.server");
    await iniciarRelatorio(diag.id);
    return { ok: true };
  });

/** Executa a geração pendente (chamada separada; o cliente não precisa aguardar). */
export const processarRelatorio = createServerFn({ method: "POST" })
  .inputValidator(entradaCodigo)
  .handler(async ({ data }) => {
    const { supabaseAdmin, diag } = await buscarPorCodigo(data.codigo);
    const { data: rel } = await supabaseAdmin
      .from("relatorios")
      .select("id")
      .eq("diagnostico_id", diag.id)
      .eq("status", "gerando")
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rel) return { ok: true };
    const { executarRelatorio } = await import("./gerar-relatorio.server");
    await executarRelatorio(rel.id);
    return { ok: true };
  });

export const lerRelatorio = createServerFn({ method: "POST" })
  .inputValidator(entradaCodigo)
  .handler(async ({ data }) => {
    let achado;
    try { achado = await buscarPorCodigo(data.codigo); } catch (e) { return { erro: (e as Error).message } as const; }
    const { supabaseAdmin, diag } = achado;
    const { data: rel } = await supabaseAdmin
      .from("relatorios")
      .select("status, conteudo, created_at")
      .eq("diagnostico_id", diag.id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Mostra a última versão concluída, se a mais nova ainda estiver gerando
    let conteudo: string | null = rel?.status === "concluido" ? rel.conteudo : null;
    if (!conteudo) {
      const { data: ok } = await supabaseAdmin
        .from("relatorios")
        .select("conteudo")
        .eq("diagnostico_id", diag.id)
        .eq("status", "concluido")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      conteudo = ok?.conteudo ?? null;
    }
    return {
      erro: null,
      nome: diag.nome_imobiliaria as string,
      statusDiagnostico: diag.status as string,
      statusRelatorio: (rel?.status ?? null) as string | null,
      conteudo,
    };
  });
