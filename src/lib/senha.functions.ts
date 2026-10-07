import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


const MAX_PEDIDOS = 5;
const JANELA_MS = 15 * 60_000;

/** Hash do IP de quem chama, para limitar pedidos sem guardar o IP. Só no servidor. */
async function hashDoIp() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const ip =
    getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`cupola:${ip}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Envia o link de redefinição de senha pelo Resend (o e-mail padrão do Supabase só entrega
 * para a equipe do projeto). A resposta é sempre a mesma, para não revelar quem tem conta.
 */
export const solicitarRedefinicaoSenha = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().trim().email().max(200) }).parse(data))
  .handler(async ({ data }) => {
    const resposta = { ok: true } as const;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Limite por conexão. sucesso=true para não contar como erro de código no questionário.
    const hash = await hashDoIp();
    const { count } = await supabaseAdmin
      .from("tentativas_codigo")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", hash)
      .eq("tipo", "senha")
      .gte("created_at", new Date(Date.now() - JANELA_MS).toISOString());
    if ((count ?? 0) >= MAX_PEDIDOS) return resposta;
    await supabaseAdmin.from("tentativas_codigo").insert({ ip_hash: hash, sucesso: true, tipo: "senha" });

    const email = data.email.toLowerCase();
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !link?.user || !link.properties?.hashed_token) return resposta;

    // Só quem tem acesso ao painel recebe o link.
    const { data: papeis } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", link.user.id);
    if (!papeis?.length) return resposta;

    const { enviarEmail, urlApp } = await import("@/lib/email.server");
    const url = `${urlApp()}/redefinir-senha?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1114">
<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#3a3f47">Painel CUPOLA</p>
<h1 style="font-size:20px">Redefinição de senha</h1>
<p>Recebemos um pedido para redefinir a senha de acesso de <b>${esc(email)}</b> ao painel do mapeamento da Imersão Cupola Aluguel.</p>
<p><a href="${url}" style="display:inline-block;background:#0f1114;color:#b0f90a;padding:12px 22px;border-radius:99px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
<p style="font-size:13px;color:#6b7078">O link vale por tempo limitado e só pode ser usado uma vez. Se você não pediu a redefinição, ignore este e-mail: sua senha atual continua valendo.</p></div>`;
    try {
      await enviarEmail({ para: email, assunto: "Redefinição de senha do painel CUPOLA", html });
    } catch (e) {
      console.error("redefinição de senha não enviada", email, (e as Error).message);
    }
    return resposta;
  });
