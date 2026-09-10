import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function garantirAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

function chaveDe(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

const opcaoSchema = z.string().trim().min(1).max(200);

const perguntaSchema = z.object({
  secao: z.number().int().min(1).max(6),
  texto: z.string().trim().min(3).max(500),
  descricao: z.string().trim().max(500).optional().nullable(),
  tipo: z.enum(["texto", "texto_longo", "escolha_unica", "escolha_multipla", "numero", "moeda"]),
  opcoes: z.array(opcaoSchema).default([]),
  permite_outro: z.boolean().default(false),
  obrigatoria: z.boolean().default(true),
  ordem: z.number().int().min(0).default(0),
});

/* ---------------- Perguntas ---------------- */

export const listarPerguntas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("perguntas_formulario")
      .select("*")
      .order("secao", { ascending: true })
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => perguntaSchema.parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    if (
      (data.tipo === "escolha_unica" || data.tipo === "escolha_multipla") &&
      data.opcoes.length === 0
    ) {
      throw new Error("Perguntas de escolha precisam de pelo menos uma opção.");
    }
    const base = chaveDe(data.texto) || "pergunta";
    let chave = base;
    for (let i = 2; i < 30; i++) {
      const { data: existe } = await context.supabase
        .from("perguntas_formulario")
        .select("id")
        .eq("chave", chave)
        .maybeSingle();
      if (!existe) break;
      chave = `${base}_${i}`;
    }
    const { data: criada, error } = await context.supabase
      .from("perguntas_formulario")
      .insert({
        secao: data.secao,
        chave,
        texto: data.texto,
        descricao: data.descricao ?? null,
        tipo: data.tipo,
        opcoes: data.opcoes,
        permite_outro: data.permite_outro,
        obrigatoria: data.obrigatoria,
        ordem: data.ordem,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return criada;
  });

export const atualizarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    perguntaSchema.partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { id, ...resto } = data;
    const campos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resto)) if (v !== undefined) campos[k] = v;
    if (
      (resto.tipo === "escolha_unica" || resto.tipo === "escolha_multipla") &&
      (resto.opcoes?.length ?? 0) === 0
    ) {
      throw new Error("Perguntas de escolha precisam de pelo menos uma opção.");
    }
    const { data: atualizada, error } = await context.supabase
      .from("perguntas_formulario")
      .update(campos as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return atualizada;
  });

export const alternarPergunta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("perguntas_formulario")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reordenarPerguntas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        itens: z.array(z.object({ id: z.string().uuid(), ordem: z.number().int().min(0) })).max(200),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    for (const item of data.itens) {
      const { error } = await context.supabase
        .from("perguntas_formulario")
        .update({ ordem: item.ordem })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ---------------- Prompt do agente ---------------- */

/** Modelos da Anthropic disponíveis para gerar o diagnóstico. */
export const MODELOS_ANTHROPIC = [
  {
    id: "claude-sonnet-4-6",
    nome: "Claude Sonnet 4.6",
    descricao: "Equilíbrio recomendado entre qualidade e custo (US$ 3 / US$ 15 por milhão).",
  },
  {
    id: "claude-sonnet-4-5",
    nome: "Claude Sonnet 4.5",
    descricao: "Geração anterior do Sonnet (US$ 3 / US$ 15 por milhão).",
  },
  {
    id: "claude-opus-4-1",
    nome: "Claude Opus 4.1",
    descricao: "Máxima profundidade de análise, bem mais caro (US$ 15 / US$ 75 por milhão).",
  },
  {
    id: "claude-haiku-4-5",
    nome: "Claude Haiku 4.5",
    descricao: "Mais rápido e econômico, análise mais simples (US$ 1 / US$ 5 por milhão).",
  },
] as const;

const MODELOS_IDS = MODELOS_ANTHROPIC.map((m) => m.id) as unknown as [string, ...string[]];

export const listarVersoesPrompt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("configuracoes_agente")
      .select("id, prompt_sistema, versao, ativo, created_at, modelo")
      .order("versao", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const salvarPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        prompt_sistema: z.string().trim().min(20).max(50000),
        modelo: z.enum(MODELOS_IDS).default("claude-sonnet-4-6"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data: ultima } = await context.supabase
      .from("configuracoes_agente")
      .select("versao")
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const proxima = (ultima?.versao ?? 0) + 1;

    const { error: desativar } = await context.supabase
      .from("configuracoes_agente")
      .update({ ativo: false })
      .eq("ativo", true);
    if (desativar) throw new Error(desativar.message);

    const { data: criada, error } = await context.supabase
      .from("configuracoes_agente")
      .insert({
        prompt_sistema: data.prompt_sistema,
        versao: proxima,
        ativo: true,
        criado_por: context.userId,
        modelo: data.modelo,
      } as never)
      .select("id, versao, modelo")
      .single();
    if (error) throw new Error(error.message);
    return criada;
  });

export const definirModeloAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ modelo: z.enum(MODELOS_IDS) }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("configuracoes_agente")
      .update({ modelo: data.modelo } as never)
      .eq("ativo", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ativarVersaoPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { error: off } = await context.supabase
      .from("configuracoes_agente")
      .update({ ativo: false })
      .eq("ativo", true);
    if (off) throw new Error(off.message);
    const { error } = await context.supabase
      .from("configuracoes_agente")
      .update({ ativo: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
