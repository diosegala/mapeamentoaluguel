// Chamadas à API da Anthropic compartilhadas pela geração e pela revisão dos relatórios.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function chaveAnthropic(): Promise<string | null> {
  const doAmbiente = process.env["ANTHROPIC_API_KEY"] ?? "";
  if (doAmbiente.length > 10) return doAmbiente;
  const { data } = await supabaseAdmin.rpc("ler_segredo" as never, {
    p_nome: "ANTHROPIC_API_KEY",
  } as never);
  const guardada = (data as string | null) ?? "";
  return guardada.length > 10 ? guardada : null;
}

export type ResultadoStream = {
  ok: boolean;
  status: number;
  erro: string;
  transitorio: boolean;
  recebeuTexto: boolean;
  texto: string;
  stop: string | null;
  usage: { input: number; output: number; cacheCriacao: number; cacheLeitura: number };
};

/** Chama a Anthropic em streaming (mantém a conexão ativa e evita 524). */
export async function chamarAnthropicStream(chave: string, corpo: unknown): Promise<ResultadoStream> {
  const res: ResultadoStream = {
    ok: false, status: 0, erro: "", transitorio: false, recebeuTexto: false, texto: "", stop: null,
    usage: { input: 0, output: 0, cacheCriacao: 0, cacheLeitura: 0 },
  };
  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    res.erro = `sem conexão com a Anthropic (${(e as Error).message})`;
    res.transitorio = true;
    return res;
  }
  res.status = resp.status;
  if (!resp.ok || !resp.body) {
    const json: any = await resp.json().catch(() => null);
    res.erro = json?.error?.message ?? "erro desconhecido";
    res.transitorio = resp.status === 429 || resp.status >= 500;
    return res;
  }
  const leitor = resp.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const linha = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!linha) continue;
        let ev: any;
        try { ev = JSON.parse(linha.slice(5).trim()); } catch { continue; }
        if (ev.type === "message_start") {
          const u = ev.message?.usage ?? {};
          res.usage.input += u.input_tokens ?? 0;
          res.usage.cacheCriacao += u.cache_creation_input_tokens ?? 0;
          res.usage.cacheLeitura += u.cache_read_input_tokens ?? 0;
          res.usage.output += u.output_tokens ?? 0;
        } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          res.texto += ev.delta.text ?? "";
          res.recebeuTexto = true;
        } else if (ev.type === "message_delta") {
          if (ev.delta?.stop_reason) res.stop = ev.delta.stop_reason;
          if (ev.usage?.output_tokens != null) res.usage.output = ev.usage.output_tokens;
        } else if (ev.type === "error") {
          res.erro = ev.error?.message ?? "erro no streaming";
          res.transitorio = ["overloaded_error", "api_error"].includes(ev.error?.type);
          res.status = ev.error?.type === "overloaded_error" ? 529 : 500;
          return res;
        }
      }
    }
  } catch (e) {
    res.erro = `conexão interrompida (${(e as Error).message})`;
    res.transitorio = true;
    res.status = 599;
    return res;
  }
  res.ok = true;
  return res;
}

/** Uma nova tentativa, após 5 s, para quedas passageiras antes de qualquer texto recebido. */
export async function chamarComRetry(chave: string, corpo: unknown): Promise<ResultadoStream> {
  const r = await chamarAnthropicStream(chave, corpo);
  if (r.ok || !r.transitorio || r.recebeuTexto) return r;
  await new Promise((ok) => setTimeout(ok, 5000));
  return chamarAnthropicStream(chave, corpo);
}
