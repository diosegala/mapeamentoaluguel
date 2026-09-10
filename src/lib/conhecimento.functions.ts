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
