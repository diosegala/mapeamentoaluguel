import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarCodigo(tamanho = 8) {
  let saida = "";
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  for (const b of bytes) saida += ALFABETO[b % ALFABETO.length];
  return saida;
}

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

export const listarDiagnosticos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("diagnosticos")
      .select("id, codigo, nome_imobiliaria, cidade, estado, status, created_at, concluido_em")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarDiagnostico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nome_imobiliaria: z.string().trim().min(2).max(160),
        cidade: z.string().trim().min(2).max(120),
        estado: z.string().trim().min(2).max(2),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);

    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const codigo = gerarCodigo(8);
      const { data: criado, error } = await context.supabase
        .from("diagnosticos")
        .insert({
          codigo,
          nome_imobiliaria: data.nome_imobiliaria,
          cidade: data.cidade,
          estado: data.estado.toUpperCase(),
        })
        .select("id, codigo")
        .single();
      if (!error && criado) return criado;
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    }
    throw new Error("Não foi possível gerar um código único. Tente novamente.");
  });

export const souAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: Boolean(data) };
  });

export const detalheDiagnostico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const [{ data: diag, error }, { data: relatorios }, { data: perguntas }] = await Promise.all([
      context.supabase.from("diagnosticos").select("*").eq("id", data.id).single(),
      context.supabase
        .from("relatorios")
        .select("id, versao, status, conteudo, erro, modelo, tokens_entrada, tokens_saida, created_at")
        .eq("diagnostico_id", data.id)
        .order("versao", { ascending: false }),
      context.supabase.from("perguntas_formulario").select("chave, texto, secao, ordem").order("secao").order("ordem"),
    ]);
    if (error || !diag) throw new Error("Diagnóstico não encontrado.");
    return {
      diagnostico: diag as any,
      relatorios: (relatorios ?? []) as any[],
      perguntas: (perguntas ?? []) as Array<{ chave: string; texto: string; secao: number }>,
    };
  });

export const regenerarRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { iniciarRelatorio, executarRelatorio } = await import("./gerar-relatorio.server");
    const relId = await iniciarRelatorio(data.id);
    await executarRelatorio(relId);
    return { ok: true };
  });

export const enviarRelatorioPorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().trim().email("Informe um e-mail válido.").max(200),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);

    const [{ data: diag, error }, { data: relatorio }] = await Promise.all([
      context.supabase
        .from("diagnosticos")
        .select("id, codigo, nome_imobiliaria")
        .eq("id", data.id)
        .single(),
      context.supabase
        .from("relatorios")
        .select("id")
        .eq("diagnostico_id", data.id)
        .eq("status", "concluido")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (error || !diag) throw new Error("Diagnóstico não encontrado.");
    if (!relatorio) throw new Error("Ainda não há um relatório concluído para enviar.");

    const base = (process.env["APP_URL"] ?? "https://mapeamentoaluguel.lovable.app").replace(/\/$/, "");
    const link = `${base}/relatorio/${diag.codigo}`;

    const { enviarEmail, montarEmailRelatorio } = await import("./email.server");
    const { assunto, html } = montarEmailRelatorio({
      nomeImobiliaria: diag.nome_imobiliaria,
      linkRelatorio: link,
    });
    await enviarEmail({ para: data.email, assunto, html });
    return { ok: true };
  });
