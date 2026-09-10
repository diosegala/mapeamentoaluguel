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
  "claude-sonnet-4-6": { entrada: 3, saida: 15 },
  "claude-sonnet-4-5": { entrada: 3, saida: 15 },
  "claude-opus-4-1": { entrada: 15, saida: 75 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
};

const PADRAO = { entrada: 3, saida: 15 };

export function custoDe(modelo: string | null, entrada: number, saida: number) {
  const p = (modelo && PRECOS[modelo]) || PADRAO;
  return (entrada / 1_000_000) * p.entrada + (saida / 1_000_000) * p.saida;
}

export const statusChaveAnthropic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const chave = process.env["ANTHROPIC_API_KEY"] ?? "";
    return {
      configurada: chave.length > 10,
      final: chave ? chave.slice(-4) : null,
    };
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
        "id, created_at, modelo, tokens_entrada, tokens_saida, status, diagnostico_id, diagnosticos(codigo, nome_imobiliaria)",
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (data.de) consulta = consulta.gte("created_at", `${data.de}T00:00:00Z`);
    if (data.ate) consulta = consulta.lte("created_at", `${data.ate}T23:59:59Z`);
    if (data.diagnostico_id) consulta = consulta.eq("diagnostico_id", data.diagnostico_id);
    if (data.modelo) consulta = consulta.eq("modelo", data.modelo);

    const { data: linhas, error } = await consulta;
    if (error) throw new Error(error.message);

    return (linhas ?? []).map((l: any) => {
      const entrada = l.tokens_entrada ?? 0;
      const saida = l.tokens_saida ?? 0;
      return {
        id: l.id as string,
        created_at: l.created_at as string,
        modelo: (l.modelo ?? null) as string | null,
        status: l.status as string,
        entrada,
        saida,
        custo: custoDe(l.modelo ?? null, entrada, saida),
        cliente: l.diagnosticos?.nome_imobiliaria ?? "—",
        codigo: l.diagnosticos?.codigo ?? "—",
        diagnostico_id: l.diagnostico_id as string,
      };
    });
  });
