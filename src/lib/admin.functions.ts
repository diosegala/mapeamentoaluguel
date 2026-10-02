import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPapel } from "@/lib/papeis";

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
    // Admins e Atendimento cadastram clientes; a escrita usa a chave de serviço depois da checagem de papel.
    await garantirPapel(context.supabase, context.userId, ["admin", "cs"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const codigo = gerarCodigo(8);
      const { data: criado, error } = await supabaseAdmin
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const tabela of ["auditorias", "envios_email", "relatorios"] as const) {
      const { error } = await supabaseAdmin
        .from(tabela)
        .delete()
        .eq("diagnostico_id", data.id);
      if (error) throw new Error(error.message);
    }
    const { error } = await supabaseAdmin.from("diagnosticos").delete().eq("id", data.id);
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
    const [{ data: diag, error }, { data: relatorios }, { data: perguntas }, { data: revisoes }] = await Promise.all([
      context.supabase.from("diagnosticos").select("*").eq("id", data.id).single(),
      context.supabase
        .from("relatorios")
        .select("id, versao, status, conteudo, conteudo_ia, publicado_em, revisado_em, nota_revisao, erro, modelo, tokens_entrada, tokens_saida, created_at")
        .eq("diagnostico_id", data.id)
        .order("versao", { ascending: false }),
      context.supabase.from("perguntas_formulario").select("chave, texto, secao, ordem").order("secao").order("ordem"),
      context.supabase
        .from("auditorias")
        .select("id, relatorio_id, automatica, veredito, resumo, problemas, correcoes_aplicadas, created_at")
        .eq("diagnostico_id", data.id)
        .eq("automatica", true)
        .order("created_at", { ascending: false }),
    ]);
    if (error || !diag) throw new Error("Diagnóstico não encontrado.");
    const { numerosDestaque } = await import("./indicadores-operacao");
    const { data: cfgEmail } = await context.supabase.from("configuracao_email").select("envio_automatico").limit(1).maybeSingle();
    return {
      envioAutomatico: Boolean(cfgEmail?.envio_automatico),
      diagnostico: diag as any,
      numeros: numerosDestaque(((diag as any).respostas ?? {}) as Record<string, unknown>),
      relatorios: (relatorios ?? []) as any[],
      revisoes: (revisoes ?? []) as any[],
      perguntas: (perguntas ?? []) as Array<{ chave: string; texto: string; secao: number }>,
    };
  });

export const auditarRelatorioIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        relatorioId: z.string().uuid(),
        modelo: z.string().trim().max(80).optional(),
      })
      .parse(data),
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
    const { revisarRelatorio, registrarRevisao } = await import("./auditoria.server");
    const { chaveAnthropic } = await import("./anthropic.server");
    const { blocosCalculados } = await import("./indicadores-operacao");
    const { modeloAuditoriaValido, revisaoEmMarkdown } = await import("./auditoria-modelos");
    const chave = await chaveAnthropic();
    if (!chave) throw new Error("Chave da Anthropic não configurada. Cadastre-a na tela de API.");
    const { projecao, indicadores } = blocosCalculados(respostas);
    const contexto = [
      `<imobiliaria>\n${cadastro}\n</imobiliaria>`,
      `<respostas>\n${texto}\n</respostas>`,
      ...(indicadores ? [`<indicadores>\n${indicadores}\n</indicadores>`] : []),
      ...(projecao ? [`<projecao_carteira>\n${projecao}\n</projecao_carteira>`] : []),
    ].join("\n\n");
    const revisao = await revisarRelatorio({
      chave,
      modelo: modeloAuditoriaValido(data.modelo),
      contexto,
      relatorio: rel.conteudo as string,
    });
    await registrarRevisao({
      diagnosticoId: data.id,
      relatorioId: data.relatorioId,
      revisao,
      aplicadas: 0,
      automatica: false,
    });
    if (revisao.veredito === "falhou") throw new Error(revisao.resumo);
    return { conteudo: revisaoEmMarkdown(revisao), modelo: revisao.modelo };
  });

export const regenerarRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    // Só entra na fila: a geração roda no servidor (rota /api/fila-relatorios), sem depender desta página.
    const { iniciarRelatorio } = await import("./gerar-relatorio.server");
    await iniciarRelatorio(data.id);
    return { ok: true };
  });

const entradaRevisao = (data: unknown) =>
  z
    .object({
      id: z.string().uuid(),
      relatorioId: z.string().uuid(),
      conteudo: z.string().trim().min(200, "O relatório ficou curto demais.").max(200_000),
      nota: z.string().trim().max(4000).optional(),
    })
    .parse(data);

/** Salva o texto revisado sem publicar. Só vale para versões ainda não publicadas. */
export const salvarRevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(entradaRevisao)
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data: linhas, error } = await context.supabase
      .from("relatorios")
      .update({ conteudo: data.conteudo, nota_revisao: data.nota ?? null })
      .eq("id", data.relatorioId)
      .eq("diagnostico_id", data.id)
      .eq("status", "concluido")
      .is("publicado_em", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!linhas?.length) throw new Error("Esta versão já foi publicada ou não está pronta para revisão.");
    return { ok: true };
  });

/** Publica a versão revisada e envia o e-mail ao cliente. A publicação vale mesmo se o envio falhar. */
export const aprovarEEnviar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(entradaRevisao)
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const agora = new Date().toISOString();
    const { data: linhas, error } = await context.supabase
      .from("relatorios")
      .update({
        conteudo: data.conteudo,
        nota_revisao: data.nota ?? null,
        publicado_em: agora,
        revisado_em: agora,
        revisado_por: context.userId,
      })
      .eq("id", data.relatorioId)
      .eq("diagnostico_id", data.id)
      .eq("status", "concluido")
      .is("publicado_em", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!linhas?.length) throw new Error("Esta versão já foi publicada ou não está pronta para revisão.");
    await context.supabase.from("diagnosticos").update({ status: "concluido" }).eq("id", data.id);
    const { enviarRelatorioDiagnostico } = await import("./email.server");
    const envio = await enviarRelatorioDiagnostico({ diagnosticoId: data.id, relatorioId: data.relatorioId, automatico: false });
    return { ok: true, enviado: envio.ok, erroEnvio: envio.ok ? null : (envio.erro ?? "Falha no envio.") };
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
      .not("publicado_em", "is", null)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!relatorio) throw new Error("Ainda não há versão aprovada para enviar. Revise e aprove antes.");
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

export const errosRecentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("relatorios")
      .select("id, erro, created_at, versao, diagnostico_id, diagnosticos(nome_imobiliaria, codigo, status)")
      .eq("status", "erro")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).filter((r) => r.diagnosticos?.status === "erro_geracao");
  });
