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

const urlSchema = z
  .string()
  .trim()
  .url("Informe um link válido.")
  .max(1000);

export const listarDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("base_conhecimento")
      .select("*")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adicionarDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        titulo: z.string().trim().max(200).optional().nullable(),
        links: z.string().trim().min(5).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);

    const links = data.links
      .split(/[\s,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (links.length === 0) throw new Error("Cole pelo menos um link.");

    const validos: string[] = [];
    for (const link of links) {
      const r = urlSchema.safeParse(link);
      if (!r.success) throw new Error(`Link inválido: ${link}`);
      validos.push(r.data);
    }

    const { data: ultimo } = await context.supabase
      .from("base_conhecimento")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    let ordem = (ultimo?.ordem ?? 0) + 1;

    const registros = validos.map((url, i) => ({
      titulo:
        validos.length === 1 && data.titulo
          ? data.titulo
          : (data.titulo ? `${data.titulo} ${i + 1}` : `Documento ${ordem + i}`),
      url_google_docs: url,
      origem: "google_docs",
      status_sincronizacao: "pendente",
      ordem: ordem + i,
    }));

    const { data: criados, error } = await context.supabase
      .from("base_conhecimento")
      .insert(registros)
      .select("id");
    if (error) throw new Error(error.message);
    return { total: criados?.length ?? 0 };
  });

export const atualizarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().trim().min(1).max(200).optional(),
        url_google_docs: urlSchema.optional(),
        ativo: z.boolean().optional(),
        ordem: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { id, ...resto } = data;
    const campos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resto)) if (v !== undefined) campos[k] = v;
    const { error } = await context.supabase
      .from("base_conhecimento")
      .update(campos as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("base_conhecimento")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Leitura dos documentos + análise da IA                              */
/* ------------------------------------------------------------------ */

const MODELO = "claude-sonnet-4-6";
const LIMITE_ANALISE = 40_000;

async function chaveAnthropic(): Promise<string | null> {
  const doAmbiente = process.env["ANTHROPIC_API_KEY"] ?? "";
  if (doAmbiente.length > 10) return doAmbiente;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("ler_segredo" as never, {
    p_nome: "ANTHROPIC_API_KEY",
  } as never);
  const guardada = (data as string | null) ?? "";
  return guardada.length > 10 ? guardada : null;
}

function urlDeExportacao(url: string): string {
  const m = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://docs.google.com/document/d/${m[1]}/export?format=txt`;
  return url;
}

function limparHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

class ErroLeitura extends Error {}

async function baixarTexto(url: string): Promise<string> {
  const alvo = urlDeExportacao(url);
  let resposta: Response;
  try {
    resposta = await fetch(alvo, { redirect: "follow" });
  } catch {
    throw new ErroLeitura("Não consegui acessar o link. Verifique se ele está correto.");
  }

  const destino = resposta.url ?? "";
  if (destino.includes("accounts.google.com") || resposta.status === 401 || resposta.status === 403) {
    throw new ErroLeitura(
      "O documento não está público. No Google Docs, use Compartilhar → \"Qualquer pessoa com o link\" pode ver.",
    );
  }
  if (!resposta.ok) {
    throw new ErroLeitura(`O link respondeu com erro ${resposta.status}.`);
  }

  const tipo = resposta.headers.get("content-type") ?? "";
  const bruto = await resposta.text();

  if (/^\s*%PDF/.test(bruto)) {
    throw new ErroLeitura("Formato não suportado (PDF). Use um Google Docs ou uma página de texto.");
  }

  const texto = tipo.includes("text/html") ? limparHtml(bruto) : bruto.trim();

  if (texto.length < 30) throw new ErroLeitura("O documento veio vazio ou quase vazio.");
  if (/Fa(ç|c)a login|Sign in|Request access|Você precisa de acesso/i.test(texto.slice(0, 400))) {
    throw new ErroLeitura(
      "O link levou a uma página de login do Google. Compartilhe o documento como público para leitura.",
    );
  }
  return texto;
}

type Analise = { resumo: string; temas: string[]; insights: string[] };

async function analisarComIa(titulo: string, texto: string, chave: string): Promise<Analise> {
  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1200,
      system:
        "Você é um consultor sênior da CUPOLA especialista em operação de locação de imobiliárias. " +
        "Leia o documento e responda APENAS com um JSON válido no formato " +
        '{"resumo": string, "temas": string[], "insights": string[]}. ' +
        "O resumo tem no máximo 3 frases. Liste de 3 a 6 temas curtos e de 3 a 6 insights objetivos e acionáveis, em português do Brasil.",
      messages: [
        {
          role: "user",
          content: `Título: ${titulo}\n\nConteúdo:\n${texto.slice(0, LIMITE_ANALISE)}`,
        },
      ],
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`A IA não conseguiu analisar (${resposta.status}). ${detalhe.slice(0, 200)}`);
  }

  const json = (await resposta.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const bruto = (json.content ?? []).map((c) => c.text ?? "").join("").trim();
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new Error("A IA respondeu num formato inesperado.");

  const parsed = JSON.parse(bruto.slice(inicio, fim + 1)) as Partial<Analise>;
  return {
    resumo: typeof parsed.resumo === "string" ? parsed.resumo : "",
    temas: Array.isArray(parsed.temas) ? parsed.temas.map(String).slice(0, 8) : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights.map(String).slice(0, 8) : [],
  };
}

async function processarDocumento(supabase: any, id: string) {
  const { data: doc, error } = await supabase
    .from("base_conhecimento")
    .select("id, titulo, url_google_docs")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Documento não encontrado.");
  if (!doc.url_google_docs) throw new Error("Este registro não tem link cadastrado.");

  const agora = new Date().toISOString();

  let texto: string;
  try {
    texto = await baixarTexto(doc.url_google_docs);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Não consegui ler o documento.";
    await supabase
      .from("base_conhecimento")
      .update({
        status_sincronizacao: "erro",
        erro_sincronizacao: mensagem,
        ultima_sincronizacao: agora,
      } as never)
      .eq("id", id);
    return { ok: false, status: "erro" as const, mensagem };
  }

  await supabase
    .from("base_conhecimento")
    .update({
      conteudo: texto,
      caracteres: texto.length,
      trecho: texto.slice(0, 400),
      ultima_sincronizacao: agora,
      status_sincronizacao: "lido",
      erro_sincronizacao: null,
    } as never)
    .eq("id", id);

  const chave = await chaveAnthropic();
  if (!chave) {
    await supabase
      .from("base_conhecimento")
      .update({
        erro_sincronizacao:
          "Documento lido, mas a análise não rodou: a chave da Anthropic ainda não foi configurada.",
      } as never)
      .eq("id", id);
    return { ok: true, status: "lido" as const, mensagem: "Documento lido, sem análise da IA." };
  }

  try {
    const analise = await analisarComIa(doc.titulo ?? "Documento", texto, chave);
    await supabase
      .from("base_conhecimento")
      .update({
        resumo_ia: analise.resumo,
        temas: analise.temas,
        insights: analise.insights,
        analisado_em: new Date().toISOString(),
        status_sincronizacao: "ok",
        erro_sincronizacao: null,
      } as never)
      .eq("id", id);
    return { ok: true, status: "ok" as const, mensagem: "Documento lido e analisado." };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha na análise da IA.";
    await supabase
      .from("base_conhecimento")
      .update({ status_sincronizacao: "lido", erro_sincronizacao: mensagem } as never)
      .eq("id", id);
    return { ok: true, status: "lido" as const, mensagem };
  }
}

export const sincronizarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    return processarDocumento(context.supabase, data.id);
  });

export const sincronizarTodos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("base_conhecimento")
      .select("id")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);

    let ok = 0;
    let falhas = 0;
    for (const d of data ?? []) {
      try {
        const r = await processarDocumento(context.supabase, d.id);
        if (r.ok) ok += 1;
        else falhas += 1;
      } catch {
        falhas += 1;
      }
    }
    return { ok, falhas };
  });

