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

export const excluirDiagnostico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    for (const tabela of ["auditorias", "envios_email", "relatorios"] as const) {
      const { error } = await context.supabase
        .from(tabela)
        .delete()
        .eq("diagnostico_id", data.id);
      if (error) throw new Error(error.message);
    }
    const { error } = await context.supabase.from("diagnosticos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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

export const auditarRelatorioIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), relatorioId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const [{ data: diag }, { data: rel }, { data: perguntas }] = await Promise.all([
      context.supabase.from("diagnosticos").select("*").eq("id", data.id).single(),
      context.supabase
        .from("relatorios")
        .select("conteudo")
        .eq("id", data.relatorioId)
        .eq("diagnostico_id", data.id)
        .single(),
      context.supabase.from("perguntas_formulario").select("chave, texto, secao, ordem").order("secao").order("ordem"),
    ]);
    if (!diag || !rel?.conteudo) throw new Error("Relatório não encontrado.");
    const d = diag as any;
    const respostas = (d.respostas ?? {}) as Record<string, unknown>;
    const fmt = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v));
    const texto = (perguntas ?? [])
      .filter((p: any) => p.chave in respostas)
      .map((p: any) => {
        const outro = respostas[`${p.chave}__outro`];
        return `- ${p.texto}\n  Resposta: ${fmt(respostas[p.chave])}${outro ? ` (Outro: ${outro})` : ""}`;
      })
      .join("\n");
    const cadastro = [
      `- Imobiliária: ${d.nome_imobiliaria}`,
      `- Cidade/estado: ${d.cidade ?? "—"}/${d.estado ?? "—"}`,
      ...["nome_respondente", "email_respondente", "telefone_respondente", "email", "telefone"]
        .filter((k) => d[k])
        .map((k) => `- ${k.replace(/_/g, " ")}: ${d[k]}`),
    ].join("\n");
    const { auditarRelatorio } = await import("./auditoria.server");
    return auditarRelatorio(
      `# Dados cadastrais\n\n${cadastro}\n\n# Respostas do questionário\n\n${texto}`,
      rel.conteudo as string,
      { diagnosticoId: data.id, relatorioId: data.relatorioId },
    );
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
        email: z.string().trim().email("Informe um e-mail válido.").max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data: relatorio } = await context.supabase
      .from("relatorios")
      .select("id")
      .eq("diagnostico_id", data.id)
      .eq("status", "concluido")
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!relatorio) throw new Error("Ainda não há um relatório concluído para enviar.");
    const { enviarRelatorioDiagnostico } = await import("./email.server");
    const r = await enviarRelatorioDiagnostico({
      diagnosticoId: data.id,
      relatorioId: relatorio.id,
      para: data.email ?? null,
      automatico: false,
    });
    if (!r.ok) throw new Error(r.erro ?? "Falha ao enviar.");
    return { ok: true };
  });
