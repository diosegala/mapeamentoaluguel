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

/** Preço em dólares por milhão de tokens. */
export const PRECOS: Record<string, { entrada: number; saida: number }> = {
  "claude-sonnet-5": { entrada: 2, saida: 10 },
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-fable-5-1": { entrada: 10, saida: 50 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
  // Gerações anteriores (mantidas para o histórico de relatórios antigos)
  "claude-sonnet-4-6": { entrada: 3, saida: 15 },
  "claude-sonnet-4-5": { entrada: 3, saida: 15 },
  "claude-opus-4-1": { entrada: 15, saida: 75 },
};

const PADRAO = { entrada: 3, saida: 15 };

/** Custo em dólares; escrita em cache custa 1,25x a entrada e leitura de cache, 0,1x. */
export function custoDe(modelo: string | null, entrada: number, saida: number, cacheCriacao = 0, cacheLeitura = 0) {
  const p = (modelo && PRECOS[modelo]) || PADRAO;
  const entradaEquivalente = entrada + cacheCriacao * 1.25 + cacheLeitura * 0.1;
  return (entradaEquivalente / 1_000_000) * p.entrada + (saida / 1_000_000) * p.saida;
}

const NOME_SEGREDO = "ANTHROPIC_API_KEY";

export const statusChaveAnthropic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);

    let chave = process.env["ANTHROPIC_API_KEY"] ?? "";
    let origem: "ambiente" | "cofre" | null = chave.length > 10 ? "ambiente" : null;

    if (!origem) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin.rpc("ler_segredo" as never, {
        p_nome: NOME_SEGREDO,
      } as never);
      const guardada = (data as string | null) ?? "";
      if (guardada.length > 10) {
        chave = guardada;
        origem = "cofre";
      }
    }

    return {
      configurada: Boolean(origem),
      origem,
      final: origem ? chave.slice(-4) : null,
    };
  });

export const salvarChaveAnthropic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        chave: z
          .string()
          .trim()
          .min(20, "Chave muito curta.")
          .max(400)
          .regex(/^sk-ant-/, "A chave da Anthropic começa com sk-ant-."),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("salvar_segredo" as never, {
      p_nome: NOME_SEGREDO,
      p_valor: data.chave,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true, final: data.chave.slice(-4) };
  });

export const listarUsoApi = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        de: z.string().optional().nullable(),
        ate: z.string().optional().nullable(),
        diagnostico_id: z.string().uuid().optional().nullable(),
        modelo: z.string().optional().nullable(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);

    let consulta = context.supabase
      .from("relatorios")
      .select(
        "id, created_at, modelo, tokens_entrada, tokens_saida, tokens_cache_criacao, tokens_cache_leitura, status, diagnostico_id, diagnosticos(codigo, nome_imobiliaria)",
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (data.de) consulta = consulta.gte("created_at", `${data.de}T00:00:00Z`);
    if (data.ate) consulta = consulta.lte("created_at", `${data.ate}T23:59:59Z`);
    if (data.diagnostico_id) consulta = consulta.eq("diagnostico_id", data.diagnostico_id);
    if (data.modelo) consulta = consulta.eq("modelo", data.modelo);

    let consultaAud = (context.supabase as any)
      .from("auditorias")
      .select("id, created_at, modelo, tokens_entrada, tokens_saida, diagnostico_id, diagnosticos(codigo, nome_imobiliaria)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.de) consultaAud = consultaAud.gte("created_at", `${data.de}T00:00:00Z`);
    if (data.ate) consultaAud = consultaAud.lte("created_at", `${data.ate}T23:59:59Z`);
    if (data.diagnostico_id) consultaAud = consultaAud.eq("diagnostico_id", data.diagnostico_id);
    if (data.modelo) consultaAud = consultaAud.eq("modelo", data.modelo);

    const [{ data: linhas, error }, { data: auds }] = await Promise.all([consulta, consultaAud]);
    if (error) throw new Error(error.message);

    const mapear = (l: any, status: string) => {
      const cacheCriacao = l.tokens_cache_criacao ?? 0;
      const cacheLeitura = l.tokens_cache_leitura ?? 0;
      // Entrada exibida inclui os tokens servidos ou gravados em cache.
      const entrada = (l.tokens_entrada ?? 0) + cacheCriacao + cacheLeitura;
      const saida = l.tokens_saida ?? 0;
      return {
        id: l.id as string,
        created_at: l.created_at as string,
        modelo: (l.modelo ?? null) as string | null,
        status,
        entrada,
        saida,
        custo: custoDe(l.modelo ?? null, l.tokens_entrada ?? 0, saida, cacheCriacao, cacheLeitura),
        cliente: l.diagnosticos?.nome_imobiliaria ?? "—",
        codigo: l.diagnosticos?.codigo ?? "—",
        diagnostico_id: l.diagnostico_id as string,
      };
    };
    return [
      ...(linhas ?? []).map((l: any) => mapear(l, l.status)),
      ...((auds ?? []) as any[]).map((l) => mapear(l, "revisão")),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
