// Envio de e-mails via Resend (connector gateway). Somente servidor.
// O remetente vem de RESEND_FROM_EMAIL; enquanto o subdomínio da cupola.com.br
// não estiver verificado no Resend, usa onboarding@resend.dev (entrega apenas
// para o e-mail do dono da conta Resend — útil para testes).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
export const CHAVE_NOME = "nome_responsavel";
export const CHAVE_EMAIL = "email_responsavel";

/**
 * Remetente a partir de RESEND_FROM_EMAIL, aceitando "email" ou "Nome <email>".
 * Limpa aspas, < > convertidos em &lt; &gt; e caracteres invisíveis que painéis de segredos às vezes gravam.
 */
function remetente() {
  const bruto = (process.env["RESEND_FROM_EMAIL"] ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[​-‍﻿]/g, "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = bruto.match(/^(?:(.*?)\s*<\s*([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)\s*>|([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+))$/);
  if (!m) return "CUPOLA <onboarding@resend.dev>";
  const email = m[2] ?? m[3];
  const nome = (m[1] ?? "").replace(/["']/g, "").trim() || "CUPOLA";
  return `${nome} <${email}>`;
}

function chaves() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) throw new Error("Conexão com o Resend não configurada.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": resendKey,
  };
}

export async function enviarEmail(opcoes: { para: string; assunto: string; html: string }) {
  const resp = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...chaves() },
    body: JSON.stringify({ from: remetente(), to: [opcoes.para], subject: opcoes.assunto, html: opcoes.html }),
  });
  if (!resp.ok) {
    const corpo = await resp.text();
    console.error(`Resend falhou [${resp.status}]: ${corpo}`);
    let msg = corpo;
    try {
      msg = JSON.parse(corpo)?.message ?? corpo;
    } catch {}
    throw new Error(`Falha ao enviar (${resp.status}): ${String(msg).slice(0, 300)} Remetente usado: ${remetente()}`);
  }
  const json: any = await resp.json().catch(() => ({}));
  return { id: (json?.id as string) ?? null };
}

/** Consulta o último evento de entrega no Resend (sent, delivered, bounced...). */
export async function statusResend(id: string): Promise<string | null> {
  const resp = await fetch(`${GATEWAY_URL}/emails/${encodeURIComponent(id)}`, { headers: chaves() });
  if (!resp.ok) return null;
  const json: any = await resp.json().catch(() => null);
  return (json?.last_event as string) ?? null;
}

export type ModeloEmail = {
  assunto: string;
  titulo: string;
  corpo: string;
  texto_botao: string;
  rodape: string;
};

export type VariaveisEmail = { nome: string; imobiliaria: string; cidade: string; link: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function aplicar(texto: string, v: VariaveisEmail, html: boolean) {
  return texto.replace(/\{\{\s*(nome|imobiliaria|cidade|link)\s*\}\}/g, (_, k: keyof VariaveisEmail) =>
    html ? esc(v[k]) : v[k],
  );
}

export function renderizarEmail(m: ModeloEmail, v: VariaveisEmail) {
  const assunto = aplicar(m.assunto, v, false);
  const titulo = aplicar(esc(m.titulo), v, true);
  const paragrafos = aplicar(esc(m.corpo), v, true)
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const link = esc(v.link);
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8a8a;margin:0 0 24px;">CUPOLA · Diagnóstico da Operação de Locação</p>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">${titulo}</h1>
      ${paragrafos}
      <p style="margin:16px 0 32px;">
        <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;">${aplicar(esc(m.texto_botao), v, true)}</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#8a8a8a;margin:0;">Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <a href="${link}" style="color:#1a1a1a;word-break:break-all;">${link}</a></p>
      <hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0 16px;"/>
      <p style="font-size:12px;color:#8a8a8a;margin:0;">${aplicar(esc(m.rodape), v, true)}</p>
    </div>
  </body>
</html>`;
  return { assunto, html };
}

export async function lerConfigEmail() {
  const { data } = await supabaseAdmin.from("configuracao_email" as never).select("*").limit(1).maybeSingle();
  return data as (ModeloEmail & { id: string; envio_automatico: boolean; emails_alerta?: string; emails_revisao?: string }) | null;
}

function linkRelatorio(codigo: string) {
  const base = (process.env["APP_URL"] ?? "https://mapeamentoaluguel.cupola.com.br").replace(/\/$/, "");
  return `${base}/relatorio/${codigo}`;
}

/**
 * Envia o relatório de um diagnóstico e registra o envio. Nunca lança.
 * Se `para` não vier, usa o e-mail respondido no questionário.
 */
export async function enviarRelatorioDiagnostico(opcoes: {
  diagnosticoId: string;
  relatorioId?: string | null;
  para?: string | null;
  automatico: boolean;
}): Promise<{ ok: boolean; erro?: string; pulado?: boolean }> {
  const cfg = await lerConfigEmail();
  if (!cfg) return { ok: false, erro: "Modelo de e-mail não configurado." };
  if (opcoes.automatico && !cfg.envio_automatico) return { ok: false, pulado: true };

  const { data: diag } = await supabaseAdmin
    .from("diagnosticos")
    .select("id, codigo, nome_imobiliaria, cidade, estado, respostas")
    .eq("id", opcoes.diagnosticoId)
    .maybeSingle();
  if (!diag) return { ok: false, erro: "Diagnóstico não encontrado." };
  const resp = (diag.respostas ?? {}) as Record<string, unknown>;
  const para = String(opcoes.para ?? resp[CHAVE_EMAIL] ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para) || para.length > 200) {
    return { ok: false, erro: "E-mail do cliente ausente ou inválido." };
  }
  const nomeCompleto = String(resp[CHAVE_NOME] ?? "").trim();
  const vars: VariaveisEmail = {
    nome: nomeCompleto.split(/\s+/)[0] || "tudo bem",
    imobiliaria: diag.nome_imobiliaria,
    cidade: `${diag.cidade}/${diag.estado}`,
    link: linkRelatorio(diag.codigo),
  };
  const { assunto, html } = renderizarEmail(cfg, vars);

  const { data: envio } = await supabaseAdmin
    .from("envios_email" as never)
    .insert({
      diagnostico_id: diag.id,
      relatorio_id: opcoes.relatorioId ?? null,
      destinatario: para,
      automatico: opcoes.automatico,
    } as never)
    .select("id")
    .single();
  const envioId = (envio as { id: string } | null)?.id;

  try {
    const { id } = await enviarEmail({ para, assunto, html });
    if (envioId)
      await supabaseAdmin
        .from("envios_email" as never)
        .update({ status: "enviado", resend_id: id, updated_at: new Date().toISOString() } as never)
        .eq("id", envioId);
    return { ok: true };
  } catch (e) {
    const erro = (e as Error).message;
    if (envioId)
      await supabaseAdmin
        .from("envios_email" as never)
        .update({ status: "erro", erro, updated_at: new Date().toISOString() } as never)
        .eq("id", envioId);
    return { ok: false, erro };
  }
}

function explicarErro(erro: string): string {
  const e = erro.toLowerCase();
  if (/\((524|504|599)\)|interrompida|sem conexão/.test(e)) return "A IA demorou demais para responder ou a conexão caiu.";
  if (/\(529\)|overloaded/.test(e)) return "A Anthropic está sobrecarregada no momento.";
  if (/\(429\)/.test(e)) return "Limite de uso da Anthropic atingido temporariamente.";
  if (/\(401\)|chave/.test(e)) return "Chave da Anthropic ausente ou inválida.";
  if (/\(402\)|credit|billing/.test(e)) return "Créditos insuficientes na conta Anthropic.";
  if (/\(403\)|refusal|recusou/.test(e)) return "A IA recusou ou bloqueou o pedido.";
  if (/\(404\)|model/.test(e)) return "Modelo de IA indisponível ou inválido.";
  if (/\(400\)/.test(e)) return "Pedido inválido enviado à IA (prompt ou configuração).";
  if (/interrompeu/.test(e)) return "A IA parou antes de terminar o relatório.";
  if (/prompt ativo/.test(e)) return "Não há prompt ativo configurado.";
  return "Erro inesperado na geração.";
}

/** Endereços de uma lista configurada no painel; vazia = todos os administradores. */
async function destinatariosInternos(lista: unknown): Promise<string[]> {
  const destinos = String(lista ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  if (destinos.length) return destinos;
  const { data: papeis } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  for (const p of papeis ?? []) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
    if (data?.user?.email) destinos.push(data.user.email);
  }
  return destinos;
}

/** Avisa quem revisa que um mapeamento novo aguarda revisão humana no painel. */
export async function notificarRevisaoPendente(opcoes: { diagnosticoId: string; relatorioId: string }) {
  const [{ data: diag }, { data: rel }, cfg] = await Promise.all([
    supabaseAdmin.from("diagnosticos").select("id, codigo, nome_imobiliaria, cidade, estado").eq("id", opcoes.diagnosticoId).maybeSingle(),
    supabaseAdmin.from("relatorios").select("versao").eq("id", opcoes.relatorioId).maybeSingle(),
    lerConfigEmail(),
  ]);
  const destinos = await destinatariosInternos((cfg as any)?.emails_revisao);
  if (!destinos.length) return;
  const base = (process.env["APP_URL"] ?? "https://mapeamentoaluguel.cupola.com.br").replace(/\/$/, "");
  const link = `${base}/admin/diagnostico/${opcoes.diagnosticoId}`;
  const nome = diag?.nome_imobiliaria ?? "Diagnóstico";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1114">
<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#3a3f47">Revisão pendente</p>
<h1 style="font-size:20px">${esc(nome)}: mapeamento pronto para revisão</h1>
<p>A versão ${rel?.versao ?? "-"} foi gerada e passou pela revisão automática. O cliente só recebe depois que alguém aprovar no painel.</p>
<p><b>Código:</b> ${esc(diag?.codigo ?? "-")} · <b>Cidade:</b> ${esc(diag ? `${diag.cidade}/${diag.estado}` : "-")}</p>
<p><a href="${link}" style="display:inline-block;background:#0f1114;color:#b0f90a;padding:12px 22px;border-radius:99px;text-decoration:none;font-weight:bold">Revisar no painel</a></p></div>`;
  for (const para of destinos) {
    try {
      await enviarEmail({ para, assunto: `[Revisão] Mapeamento de ${nome} aguarda aprovação`, html });
    } catch (e) {
      console.error("aviso de revisão não enviado", para, (e as Error).message);
    }
  }
}

/** Avisa os administradores por e-mail que uma geração falhou. */
export async function notificarErroGeracao(opcoes: { diagnosticoId: string; relatorioId: string; erro: string }) {
  const [{ data: diag }, { data: rel }, cfg] = await Promise.all([
    supabaseAdmin.from("diagnosticos").select("id, codigo, nome_imobiliaria, cidade, estado").eq("id", opcoes.diagnosticoId).maybeSingle(),
    supabaseAdmin.from("relatorios").select("versao").eq("id", opcoes.relatorioId).maybeSingle(),
    lerConfigEmail(),
  ]);
  const destinos = await destinatariosInternos((cfg as any)?.emails_alerta);
  if (!destinos.length) return;
  const base = (process.env["APP_URL"] ?? "https://mapeamentoaluguel.cupola.com.br").replace(/\/$/, "");
  const link = `${base}/admin/diagnostico/${opcoes.diagnosticoId}`;
  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const nome = diag?.nome_imobiliaria ?? "Diagnóstico";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#b91c1c">Alerta · Erro na geração</p>
<h1 style="font-size:20px">${esc(nome)}: o relatório não foi gerado</h1>
<p><b>Motivo:</b> ${esc(explicarErro(opcoes.erro))}</p>
<p><b>Detalhe técnico:</b> ${esc(opcoes.erro)}</p>
<p><b>Código:</b> ${esc(diag?.codigo ?? "-")} · <b>Versão:</b> ${rel?.versao ?? "-"} · <b>Cidade:</b> ${esc(diag ? `${diag.cidade}/${diag.estado}` : "-")}</p>
<p><b>Quando:</b> ${quando}</p>
<p><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">Abrir no painel</a></p></div>`;
  for (const para of destinos) {
    try {
      await enviarEmail({ para, assunto: `[Erro] Relatório de ${nome} não foi gerado`, html });
    } catch (e) {
      console.error("alerta de erro não enviado", para, (e as Error).message);
    }
  }
}
