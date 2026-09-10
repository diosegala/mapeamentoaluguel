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

export const listarAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: papeis, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    const { data: usuarios, error: erroUsuarios } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (erroUsuarios) throw new Error(erroUsuarios.message);

    const porId = new Map(usuarios.users.map((u) => [u.id, u]));

    return (papeis ?? []).map((p) => {
      const u = porId.get(p.user_id);
      return {
        user_id: p.user_id,
        email: u?.email ?? "(usuário removido)",
        criado_em: p.created_at,
        ultimo_acesso: u?.last_sign_in_at ?? null,
        eu: p.user_id === context.userId,
      };
    });
  });

export const criarAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email("E-mail inválido.").max(200),
        senha: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").max(200),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();

    const { data: existentes } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    let userId = existentes?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;

    if (!userId) {
      const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.senha,
        email_confirm: true,
      });
      if (error || !criado.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");
      userId = criado.user.id;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.senha,
      });
      if (error) throw new Error(error.message);
    }

    const { error: erroPapel } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (erroPapel) throw new Error(erroPapel.message);

    return { user_id: userId, email };
  });

export const removerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode remover o seu próprio acesso.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
