// Envio de e-mails via Resend (connector gateway). Somente servidor.
// O remetente vem de RESEND_FROM_EMAIL; enquanto o subdomínio da cupola.com.br
// não estiver verificado no Resend, usa onboarding@resend.dev (entrega apenas
// para o e-mail do dono da conta Resend — útil para testes).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function remetente() {
  const from = process.env["RESEND_FROM_EMAIL"]?.trim();
  return from && from.length > 3 ? from : "CUPOLA <onboarding@resend.dev>";
}

export async function enviarEmail(opcoes: { para: string; assunto: string; html: string }) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");
  if (!resendKey) throw new Error("RESEND_API_KEY não configurada");

  const resp = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: remetente(),
      to: [opcoes.para],
      subject: opcoes.assunto,
      html: opcoes.html,
    }),
  });

  if (!resp.ok) {
    const corpo = await resp.text();
    console.error(`Resend falhou [${resp.status}]: ${corpo}`);
    throw new Error(`Falha ao enviar e-mail (${resp.status}): ${corpo}`);
  }
  return resp.json().catch(() => ({}));
}

export function montarEmailRelatorio(opcoes: {
  nomeImobiliaria: string;
  linkRelatorio: string;
}) {
  const assunto = `Seu diagnóstico da operação de locação está pronto — ${opcoes.nomeImobiliaria}`;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8a8a;margin:0 0 24px;">CUPOLA · Diagnóstico da Operação de Locação</p>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;">Olá! O diagnóstico da <strong>${opcoes.nomeImobiliaria}</strong> está pronto.</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        Preparamos um raio-x da sua operação de locação, com pontos fortes, gargalos e prioridades de melhoria.
        Você pode ler o relatório completo e baixar o PDF pelo botão abaixo.
      </p>
      <p style="margin:0 0 32px;">
        <a href="${opcoes.linkRelatorio}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;">
          Ver meu diagnóstico
        </a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#8a8a8a;margin:0;">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <a href="${opcoes.linkRelatorio}" style="color:#1a1a1a;word-break:break-all;">${opcoes.linkRelatorio}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0 16px;"/>
      <p style="font-size:12px;color:#8a8a8a;margin:0;">Este relatório foi gerado com apoio de inteligência artificial e revisado pela equipe CUPOLA.</p>
    </div>
  </body>
</html>`;
  return { assunto, html };
}
