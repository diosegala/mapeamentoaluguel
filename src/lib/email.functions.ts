import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function garantirAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores.");
}

const modeloSchema = z.object({
  envio_automatico: z.boolean(),
  assunto: z.string().trim().min(3).max(200),
  titulo: z.string().trim().min(3).max(300),
  corpo: z.string().trim().min(3).max(4000),
  texto_botao: z.string().trim().min(2).max(60),
  rodape: z.string().trim().max(500),
  emails_alerta: z.string().trim().max(1000).optional(),
});

export const lerModeloEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("configuracao_email" as never)
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as z.infer<typeof modeloSchema> & { id: string };
  });

export const salvarModeloEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => modeloSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { id, ...campos } = data;
    const { error } = await context.supabase
      .from("configuracao_email" as never)
      .update({ ...campos, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previaModeloEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => modeloSchema.parse(d))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { renderizarEmail } = await import("./email.server");
    return renderizarEmail(data, {
      nome: "Mariana",
      imobiliaria: "Imobiliária Exemplo",
      cidade: "Curitiba/PR",
      link: "https://mapeamentoaluguel.lovable.app/relatorio/EXEMPLO1",
    });
  });

export const listarEnviosEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("envios_email" as never)
      .select("id, destinatario, automatico, status, erro, resend_id, created_at, diagnosticos(nome_imobiliaria)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Array<{
      id: string;
      destinatario: string;
      automatico: boolean;
      status: string;
      erro: string | null;
      resend_id: string | null;
      created_at: string;
      diagnosticos: { nome_imobiliaria: string } | null;
    }>;
  });

/** Atualiza o status de entrega dos envios recentes consultando o Resend. */
export const atualizarStatusEnvios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("envios_email" as never)
      .select("id, resend_id, status")
      .not("resend_id", "is", null)
      .not("status", "in", "(delivered,bounced,complained)")
      .order("created_at", { ascending: false })
      .limit(30);
    const { statusResend } = await import("./email.server");
    let atualizados = 0;
    for (const e of (data ?? []) as Array<{ id: string; resend_id: string; status: string }>) {
      const s = await statusResend(e.resend_id);
      if (s && s !== e.status) {
        await context.supabase
          .from("envios_email" as never)
          .update({ status: s, updated_at: new Date().toISOString() } as never)
          .eq("id", e.id);
        atualizados++;
      }
    }
    return { atualizados };
  });
