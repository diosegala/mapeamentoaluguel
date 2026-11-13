import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DESCRICAO_PAPEL, ROTULOS_PAPEL, garantirPapel, papelPrincipal, type Papel } from "@/lib/papeis";

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
      const papel = papelPrincipal(atual ? [atual.papel, p.role] : [p.role]) ?? p.role;
      if (!atual || papel !== atual.papel) porUsuario.set(p.user_id, { papel, criado_em: p.created_at });
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

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type ResultadoConvite = {
  /** O e-mail saiu pelo Resend. */
  enviado: boolean;
  erroEnvio: string | null;
  /** Link para criar a senha, devolvido só quando o envio falha, para o admin mandar por outro canal. */
  link: string | null;
};

/**
 * Envia o acesso por e-mail. Quem nunca entrou recebe um link de uso único para criar a senha
 * (o mesmo fluxo de "Esqueci minha senha"); quem já entrou recebe só o aviso do papel e o link do login.
 */
async function enviarConvite(opcoes: {
  userId: string;
  email: string;
  papel: Papel;
  convidadoPor: string | null;
}): Promise<ResultadoConvite> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { enviarEmail, urlApp } = await import("@/lib/email.server");

  const { data: usuario, error: erroUsuario } = await supabaseAdmin.auth.admin.getUserById(opcoes.userId);
  if (erroUsuario || !usuario.user) throw new Error(erroUsuario?.message ?? "Usuário não encontrado.");
  const primeiroAcesso = !usuario.user.last_sign_in_at;

  let link = `${urlApp()}/auth`;
  if (primeiroAcesso) {
    const { data: gerado, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: opcoes.email });
    if (error || !gerado?.properties?.hashed_token) throw new Error(error?.message ?? "Não foi possível gerar o link do convite.");
    link = `${urlApp()}/redefinir-senha?token_hash=${encodeURIComponent(gerado.properties.hashed_token)}&type=recovery&convite=1`;
  }

  const rotulo = ROTULOS_PAPEL[opcoes.papel];
  const quem = opcoes.convidadoPor ? `<b>${esc(opcoes.convidadoPor)}</b>` : "";
  const botao = (texto: string) =>
    `<p><a href="${link}" style="display:inline-block;background:#0f1114;color:#b0f90a;padding:12px 22px;border-radius:99px;text-decoration:none;font-weight:bold">${texto}</a></p>`;
  const corpo = primeiroAcesso
    ? `<h1 style="font-size:20px">Seu acesso ao painel CUPOLA</h1>
<p>${quem ? `${quem} liberou para você` : "Você recebeu"} o acesso ao painel do mapeamento da Imersão Cupola Aluguel, com o papel de <b>${rotulo}</b>.</p>
<p style="color:#3a3f47">${esc(DESCRICAO_PAPEL[opcoes.papel])}</p>
<p>Para entrar, crie sua senha. O login é este e-mail: <b>${esc(opcoes.email)}</b>.</p>
${botao("Criar minha senha")}
<p style="font-size:13px;color:#6b7078">O link vale por tempo limitado e só pode ser usado uma vez. Se ele expirar, abra ${esc(urlApp())}/auth e use "Esqueci minha senha" com este e-mail.</p>`
    : `<h1 style="font-size:20px">Seu acesso ao painel CUPOLA foi atualizado</h1>
<p>Seu papel no painel do mapeamento da Imersão Cupola Aluguel agora é <b>${rotulo}</b>${quem ? `, definido por ${quem}` : ""}.</p>
<p style="color:#3a3f47">${esc(DESCRICAO_PAPEL[opcoes.papel])}</p>
<p>Entre com o e-mail <b>${esc(opcoes.email)}</b> e a senha que você já usa.</p>
${botao("Entrar no painel")}
<p style="font-size:13px;color:#6b7078">Se não lembrar a senha, use "Esqueci minha senha" na tela de login.</p>`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1114">
<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#3a3f47">Painel CUPOLA</p>
${corpo}</div>`;

  try {
    await enviarEmail({
      para: opcoes.email,
      assunto: primeiroAcesso ? "Seu acesso ao painel CUPOLA" : "Seu acesso ao painel CUPOLA foi atualizado",
      html,
    });
    return { enviado: true, erroEnvio: null, link: null };
  } catch (e) {
    console.error("convite não enviado", opcoes.email, (e as Error).message);
    return { enviado: false, erroEnvio: (e as Error).message, link: primeiroAcesso ? link : `${urlApp()}/auth` };
  }
}

/**
 * Cria o acesso (ou muda o papel de quem já tem conta) e envia o convite por e-mail.
 * Cada pessoa fica com um único papel. A senha é criada pela própria pessoa, pelo link do convite.
 */
export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email("E-mail inválido.").max(200),
        papel: z.enum(["admin", "cs", "mentor"]),
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
      // Sem senha: a pessoa cria a dela pelo link do convite.
      const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
      if (error || !criado.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");
      userId = criado.user.id;
    }

    const { error: erroLimpar } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).neq("role", data.papel);
    if (erroLimpar) throw new Error(erroLimpar.message);
    const { error: erroPapel } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.papel }, { onConflict: "user_id,role" });
    if (erroPapel) throw new Error(erroPapel.message);

    // O acesso já está liberado; uma falha no e-mail volta como aviso, com o link para mandar à mão.
    const convite = await enviarConvite({
      userId,
      email,
      papel: data.papel,
      convidadoPor: (context.claims.email as string | undefined) ?? null,
    });
    return { user_id: userId, email, papel: data.papel, ...convite };
  });

/** Envia de novo o convite de quem ainda não entrou (o link anterior pode ter expirado). */
export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirPapel(context.supabase, context.userId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: usuario, error }, { data: papeis }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(data.user_id),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id),
    ]);
    if (error || !usuario.user?.email) throw new Error("Usuário não encontrado.");
    const papel = papelPrincipal(((papeis ?? []) as Array<{ role: string }>).map((p) => p.role));
    if (!papel) throw new Error("Este usuário não tem acesso ao painel.");
    const email = usuario.user.email.toLowerCase();
    const convite = await enviarConvite({
      userId: data.user_id,
      email,
      papel,
      convidadoPor: (context.claims.email as string | undefined) ?? null,
    });
    return { email, ...convite };
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
