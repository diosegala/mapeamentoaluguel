import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPapel, papelDoUsuario } from "@/lib/papeis";
import { normalizarTelefone } from "@/lib/telefone";

/** Papel de quem está logado, para o painel decidir o que mostrar. */
export const meuPapel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ papel: await papelDoUsuario(context.supabase, context.userId) }));

/**
 * Clientes e andamento do questionário, para admins e Atendimento.
 * Devolve só dados de cadastro e progresso: nada de respostas nem relatórios.
 */
export const listarClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirPapel(context.supabase, context.userId, ["admin", "cs"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data, error }, { data: perguntas }] = await Promise.all([
      supabaseAdmin
        .from("diagnosticos")
        .select("id, codigo, nome_imobiliaria, cidade, estado, telefone, status, secao_atual, created_at, iniciado_em, concluido_em")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("perguntas_formulario").select("secao").eq("ativo", true),
    ]);
    if (error) throw new Error(error.message);
    const secoes = [...new Set((perguntas ?? []).map((p) => p.secao))].sort((a, b) => a - b);
    return { clientes: data ?? [], secoes };
  });

/** Inclui, corrige ou remove (vazio) o WhatsApp de um cliente. */
export const atualizarTelefone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), telefone: z.string().trim().max(30) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirPapel(context.supabase, context.userId, ["admin", "cs"]);
    const telefone = data.telefone ? normalizarTelefone(data.telefone) : null;
    if (data.telefone && !telefone) throw new Error("WhatsApp inválido. Use DDD e número, ex.: (41) 99999-8888.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("diagnosticos").update({ telefone }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { telefone };
  });
