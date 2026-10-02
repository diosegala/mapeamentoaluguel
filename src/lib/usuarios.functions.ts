import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPapel, type Papel } from "@/lib/papeis";

/** Usuários com acesso ao painel e o papel de cada um. Só administradores. */
export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: papeis, error } = await supabaseAdmin.from("user_roles").select("user_id, role, created_at");
    if (error) throw new Error(error.message);

    const { data: usuarios, error: erroUsuarios } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (erroUsuarios) throw new Error(erroUsuarios.message);
    const porId = new Map(usuarios.users.map((u) => [u.id, u]));

    // Um usuário com mais de um papel aparece uma vez, com o papel mais amplo.
    const porUsuario = new Map<string, { papel: Papel; criado_em: string }>();
    for (const p of (papeis ?? []) as Array<{ user_id: string; role: Papel; created_at: string }>) {
      const atual = porUsuario.get(p.user_id);
      if (!atual || p.role === "admin") porUsuario.set(p.user_id, { papel: p.role, criado_em: p.created_at });
    }
    return [...porUsuario.entries()]
      .map(([user_id, { papel, criado_em }]) => {
        const u = porId.get(user_id);
        return {
          user_id,
          papel,
          email: u?.email ?? "(usuário removido)",
          criado_em,
          ultimo_acesso: u?.last_sign_in_at ?? null,
          eu: user_id === context.userId,
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  });

/**
 * Cria o acesso (ou atualiza senha e papel de quem já tem conta).
 * Cada pessoa fica com um único papel.
 */
export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email("E-mail inválido.").max(200),
        senha: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").max(200),
        papel: z.enum(["admin", "cs"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: existentes } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = existentes?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (userId === context.userId && data.papel !== "admin")
      throw new Error("Você não pode tirar o seu próprio acesso de administrador.");

    if (!userId) {
      const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.senha,
        email_confirm: true,
      });
      if (error || !criado.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");
      userId = criado.user.id;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.senha });
      if (error) throw new Error(error.message);
    }

    const { error: erroLimpar } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).neq("role", data.papel);
    if (erroLimpar) throw new Error(erroLimpar.message);
    const { error: erroPapel } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.papel }, { onConflict: "user_id,role" });
    if (erroPapel) throw new Error(erroPapel.message);

    return { user_id: userId, email, papel: data.papel };
  });

/** Remove todos os papéis do usuário: ele perde o acesso ao painel. */
export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    if (data.user_id === context.userId) throw new Error("Você não pode remover o seu próprio acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
