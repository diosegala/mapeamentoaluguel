import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPapel } from "@/lib/papeis";
import type { ClienteMercado, PerguntaMercado } from "@/lib/mercado";

/** Clientes com questionário concluído e perguntas ativas; as contas ficam em mercado.ts. */
export async function carregarMercado(supabase: any): Promise<{
  perguntas: PerguntaMercado[];
  secoes: Array<{ numero: number; nome: string }>;
  clientes: ClienteMercado[];
}> {
  const [
    { data: diags, error },
    { data: perguntas, error: erroPerguntas },
    { data: secoes },
    { data: publicados },
  ] = await Promise.all([
    supabase
      .from("diagnosticos")
      .select("id, nome_imobiliaria, cidade, estado, concluido_em, respostas")
      .not("concluido_em", "is", null)
      .order("concluido_em", { ascending: true }),
    supabase
      .from("perguntas_formulario")
      .select("chave, texto, tipo, opcoes, secao, ordem")
      .eq("ativo", true)
      .order("secao")
      .order("ordem"),
    supabase.from("secoes_formulario").select("numero, nome").order("numero"),
    supabase
      .from("relatorios")
      .select("diagnostico_id, publicado_em")
      .not("publicado_em", "is", null),
  ]);
  if (error) throw new Error(error.message);
  if (erroPerguntas) throw new Error(erroPerguntas.message);
  const publicacao = new Map<string, string>();
  for (const r of (publicados ?? []) as Array<{ diagnostico_id: string; publicado_em: string }>) {
    const atual = publicacao.get(r.diagnostico_id);
    if (!atual || r.publicado_em > atual) publicacao.set(r.diagnostico_id, r.publicado_em);
  }
  return {
    perguntas: ((perguntas ?? []) as any[]).map((p) => ({
      chave: p.chave,
      texto: p.texto,
      tipo: p.tipo,
      opcoes: Array.isArray(p.opcoes) ? p.opcoes.map(String) : [],
      secao: p.secao,
      ordem: p.ordem,
    })),
    secoes: (secoes ?? []) as Array<{ numero: number; nome: string }>,
    clientes: ((diags ?? []) as any[]).map((d) => ({
      id: d.id,
      nome: d.nome_imobiliaria,
      cidade: d.cidade,
      estado: d.estado,
      concluido_em: d.concluido_em,
      respostas: (d.respostas ?? {}) as Record<string, any>,
      relatorio_publicado_em: publicacao.get(d.id) ?? null,
    })),
  };
}

export const dadosMercado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    return carregarMercado(context.supabase);
  });

const entradaFiltros = (data: unknown) =>
  z
    .object({
      estado: z.string().max(2),
      faixa: z.string().max(20),
      desde: z.string().max(10),
      excluidos: z.array(z.string().uuid()).max(500),
    })
    .parse(data);

/** Põe na fila um relatório para a liderança com o recorte atual do dashboard. */
export const gerarRelatorioMercado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(entradaFiltros)
  .handler(async ({ context, data }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    const { iniciarRelatorioMercado } = await import("./gerar-relatorio-mercado.server");
    const id = await iniciarRelatorioMercado(data, context.userId);
    return { id };
  });

export const listarRelatoriosMercado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    const { data, error } = await context.supabase
      .from("relatorios_mercado")
      .select(
        "id, versao, status, erro, base, diagnosticos_incluidos, modelo, tokens_entrada, tokens_saida, created_at",
      )
      .order("versao", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      versao: r.versao,
      status: r.status,
      erro: r.erro,
      base: r.base,
      clientes: Array.isArray(r.diagnosticos_incluidos) ? r.diagnosticos_incluidos.length : 0,
      modelo: r.modelo,
      tokens_entrada: r.tokens_entrada,
      tokens_saida: r.tokens_saida,
      created_at: r.created_at,
    }));
  });

export const lerRelatorioMercado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    const { data: r, error } = await context.supabase
      .from("relatorios_mercado")
      .select("id, versao, status, erro, base, conteudo, resumo, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Relatório não encontrado.");
    return {
      ...r,
      resumo: (r.resumo ?? null) as {
        n: number;
        carteiraMediana: number | null;
        conversaoMediana: number | null;
        crescimentoMediana: number | null;
        iaEstruturada: string | null;
      } | null,
    };
  });
